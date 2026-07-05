// Dedicated page to obtain camera permission.
// Unlike the popup, a tab does not close when the prompt appears,
// so the user can confirm correctly.

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
    // Show a preview as visual confirmation.
    preview.style.display = 'block';
    preview.srcObject = stream;
    show('✓ Fotocamera consentita! Puoi chiudere questa scheda e premere Avvia.', 'ok');
    // Release the camera after a moment: it was only needed to register the permission.
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
