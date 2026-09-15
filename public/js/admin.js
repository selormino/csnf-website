(() => {
  const initDropzone = (zone) => {
    const input = zone.querySelector('input[type=file]');
    const preview = zone.querySelector('.upload-preview');
    const choose = zone.querySelector('[data-choose-file]');
    if (!input) return;
    const show = (file) => {
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (preview) preview.innerHTML = `<img src="${reader.result}" alt="Image preview"><span>${file.name}</span>`;
        zone.classList.add('has-file');
      };
      reader.readAsDataURL(file);
    };
    choose?.addEventListener('click', (e) => { e.preventDefault(); input.click(); });
    zone.addEventListener('click', (e) => { if (e.target === zone || e.target.closest('.drop-copy')) input.click(); });
    input.addEventListener('change', () => show(input.files[0]));
    ['dragenter','dragover'].forEach(evt => zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.add('is-dragging'); }));
    ['dragleave','drop'].forEach(evt => zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.remove('is-dragging'); }));
    zone.addEventListener('drop', (e) => {
      const file = [...e.dataTransfer.files].find(f => f.type.startsWith('image/'));
      if (!file) return;
      const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files; show(file);
    });
  };
  document.querySelectorAll('.dropzone').forEach(initDropzone);
  document.querySelectorAll('[data-theme-option]').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('[data-theme-option]').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const radio = card.querySelector('input[type=radio]'); if (radio) radio.checked = true;
    });
  });
})();
