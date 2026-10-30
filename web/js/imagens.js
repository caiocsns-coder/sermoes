/* Redução de imagens antes do envio ao Drive. */

export function reduzirImagem(file) {
  return new Promise((ok, fail) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        ok(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => fail(new Error('Não foi possível ler a imagem.'));
      img.src = r.result;
    };
    r.onerror = () => fail(new Error('Não foi possível ler o arquivo.'));
    r.readAsDataURL(file);
  });
}
