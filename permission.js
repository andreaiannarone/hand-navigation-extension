// Pagina dedicata per ottenere il permesso fotocamera.
// A differenza del popup, una tab non si chiude quando appare il prompt,
// quindi l'utente può confermare correttamente.

const btn = document.getElementById('grant');
const msg = document.getElementById('msg');
const preview = document.getElementById('preview');

function show(text, kind) {
  msg.textContent = text;
  msg.className = kind || '';
}

btn.addEventListener('click', async () => {
  show('Richiesta in corso… conferma nel prompt di Chrome.', '');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    // Mostra un'anteprima come conferma visiva.
    preview.style.display = 'block';
    preview.srcObject = stream;
    show('✓ Fotocamera consentita! Puoi chiudere questa scheda e premere Avvia.', 'ok');
    // Rilascia la camera dopo un attimo: serviva solo a registrare il permesso.
    setTimeout(() => {
      stream.getTracks().forEach((t) => t.stop());
      preview.style.display = 'none';
    }, 1500);
  } catch (e) {
    let hint = e.name;
    if (e.name === 'NotAllowedError') hint = 'Permesso negato o annullato. Riprova e clicca “Consenti”.';
    else if (e.name === 'NotFoundError') hint = 'Nessuna webcam trovata.';
    else if (e.name === 'NotReadableError') hint = 'La webcam è già in uso da un\'altra app.';
    show('✕ ' + hint, 'err');
  }
});
