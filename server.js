const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const slugify = require('slugify');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const uploadsDir = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadsDir),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const base = slugify(path.basename(file.originalname || 'image', ext), { lower: true, strict: true }) || 'image';
    cb(null, `${Date.now()}-${base}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_, file, cb) => cb(null, /^image\//.test(file.mimetype))
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-only-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 8 }
}));
app.use(async (req, res, next) => {
  res.locals.site = await db.settings();
  res.locals.currentPath = req.path;
  res.locals.user = req.session.user || null;
  res.locals.placeholder = '/images/placeholder-community.svg';
  next();
});

const auth = (req, res, next) => req.session.user ? next() : res.redirect('/admin/login');
const clean = v => typeof v === 'string' ? v.trim() : v;
const bool = v => v ? 1 : 0;
const uploadedPath = file => file ? `/uploads/${file.filename}` : '';
const imageValue = (file, bodyValue, fallback = '') => uploadedPath(file) || clean(bodyValue || '') || fallback;

app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/', async (req, res) => {
  let programs = await db.list('programs', { published: true });
  let events = await db.list('events', { published: true });
  let news = await db.list('news', { published: true });
  let stories = await db.list('stories', { published: true });
  programs = programs.sort((a,b)=>b.featured-a.featured).slice(0,4);
  events = events.sort((a,b)=>b.featured-a.featured||String(b.event_date).localeCompare(String(a.event_date))).slice(0,3);
  news = news.sort((a,b)=>b.featured-a.featured||String(b.published_at).localeCompare(String(a.published_at))).slice(0,3);
  stories = stories.sort((a,b)=>b.featured-a.featured||b.id-a.id).slice(0,3);
  res.render('home', { programs, events, news, stories });
});
for (const type of ['programs','events','news','stories']) {
  app.get('/'+type, async (req,res)=>res.render('listing',{type,items:await db.list(type,{published:true})}));
  app.get('/'+type+'/:slug', async (req,res)=>{
    const item=await db.find(type,x=>x.slug===req.params.slug&&Number(x.published)===1);
    if(!item) return res.status(404).render('404');
    res.render('detail',{type,item});
  });
}
app.get('/about', async(req,res)=>res.render('about',{team:await db.list('team',{published:true})}));
app.get('/contact',(req,res)=>res.render('contact'));
app.post('/contact',(req,res)=>res.render('contact',{sent:true}));
app.get('/donate',(req,res)=>res.render('donate'));

app.get('/admin/login',(req,res)=>res.render('admin/login',{error:null}));
app.post('/admin/login',(req,res)=>{
  const ok=(clean(req.body.email).toLowerCase()===(process.env.ADMIN_EMAIL||'admin@cancersupportnf.org').toLowerCase()) && req.body.password===(process.env.ADMIN_PASSWORD||'change-me-now');
  if(!ok) return res.status(401).render('admin/login',{error:'Invalid email or password.'});
  req.session.user={email:clean(req.body.email)};
  res.redirect('/admin');
});
app.post('/admin/logout',(req,res)=>req.session.destroy(()=>res.redirect('/admin/login')));

app.get('/admin',auth,async(req,res)=>{
  const counts={};
  for(const t of ['programs','events','news','stories','team']) counts[t]=(await db.list(t)).length;
  const recent=[];
  for(const t of ['news','events','stories']) for(const x of await db.list(t)) recent.push({type:t.slice(0,-1),...x});
  recent.sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)));
  res.render('admin/dashboard',{counts,recent:recent.slice(0,8)});
});

const fields={
  programs:['title','slug','excerpt','body','image','featured','published'],
  events:['title','slug','excerpt','body','image','event_date','location','featured','published'],
  news:['title','slug','excerpt','body','image','published_at','featured','published'],
  stories:['title','slug','person','excerpt','body','image','featured','published'],
  team:['name','role','bio','image','sort_order','published']
};
for(const type of Object.keys(fields)) {
  app.get(`/admin/${type}`,auth,async(req,res)=>res.render('admin/list',{type,items:await db.list(type)}));
  app.get(`/admin/${type}/new`,auth,(req,res)=>res.render('admin/form',{type,item:{published:1},isNew:true}));
  app.post(`/admin/${type}`,auth,upload.single('image_file'),async(req,res)=>{
    const data={};
    for(const f of fields[type]) data[f]=['featured','published'].includes(f)?bool(req.body[f]):clean(req.body[f]??'');
    data.image = imageValue(req.file, req.body.image, type === 'events' ? '/images/placeholder-event.svg' : '/images/placeholder-community.svg');
    if('slug' in data && !data.slug) data.slug=slugify(data.title,{lower:true,strict:true});
    await db.insert(type,data);
    res.redirect(`/admin/${type}`);
  });
  app.get(`/admin/${type}/:id/edit`,auth,async(req,res)=>{
    const item=await db.find(type,x=>String(x.id)===String(req.params.id));
    if(!item) return res.status(404).render('404');
    res.render('admin/form',{type,item,isNew:false});
  });
  app.post(`/admin/${type}/:id`,auth,upload.single('image_file'),async(req,res)=>{
    const current = await db.find(type,x=>String(x.id)===String(req.params.id));
    const data={};
    for(const f of fields[type]) data[f]=['featured','published'].includes(f)?bool(req.body[f]):clean(req.body[f]??'');
    data.image = imageValue(req.file, req.body.image, current?.image || '/images/placeholder-community.svg');
    if('slug' in data && !data.slug) data.slug=slugify(data.title,{lower:true,strict:true});
    await db.update(type,req.params.id,data);
    res.redirect(`/admin/${type}`);
  });
  app.post(`/admin/${type}/:id/delete`,auth,async(req,res)=>{await db.remove(type,req.params.id);res.redirect(`/admin/${type}`);});
}

app.get('/admin/settings',auth,async(req,res)=>res.render('admin/settings',{values:await db.settings()}));
app.post('/admin/settings',auth,async(req,res)=>{
  const data={};
  for(const[k,v]of Object.entries(req.body)) data[k]=clean(v);
  await db.updateSettings(data);
  res.redirect('/admin/settings?saved=1');
});

app.get('/admin/appearance',auth,async(req,res)=>res.render('admin/appearance',{values:await db.settings()}));
app.post('/admin/appearance',auth,upload.fields([{name:'hero_image_file',maxCount:1},{name:'logo_image_file',maxCount:1}]),async(req,res)=>{
  const current = await db.settings();
  const heroFile = req.files?.hero_image_file?.[0];
  const logoFile = req.files?.logo_image_file?.[0];
  const allowedThemes = ['hope','emerald','aurora','classic'];
  const data = {
    theme: allowedThemes.includes(req.body.theme) ? req.body.theme : 'hope',
    accent_color: /^#[0-9a-fA-F]{6}$/.test(req.body.accent_color||'') ? req.body.accent_color : (current.accent_color || '#cf2e6c'),
    hero_image: imageValue(heroFile, req.body.hero_image, current.hero_image || '/images/placeholder-care.svg'),
    logo_image: imageValue(logoFile, req.body.logo_image, current.logo_image || ''),
    hero_badge: clean(req.body.hero_badge || current.hero_badge || 'Compassionate cancer care'),
    card_style: ['soft','glass','outline'].includes(req.body.card_style) ? req.body.card_style : 'soft'
  };
  await db.updateSettings(data);
  res.redirect('/admin/appearance?saved=1');
});

app.use((err,req,res,next)=>{
  if(err instanceof multer.MulterError || err?.message?.includes('image')) return res.status(400).send('Image upload failed. Please use JPG, PNG, GIF, WEBP or SVG under 8MB.');
  next(err);
});
app.use((req,res)=>res.status(404).render('404'));

db.init().then(()=>app.listen(PORT,'0.0.0.0',()=>console.log(`CSNF site running on ${PORT}`))).catch(e=>{console.error(e);process.exit(1)});
