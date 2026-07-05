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

const getMsg = (k, subs) => chrome.i18n.getMessage(k, subs);

btn.addEventListener('click', async () => {
  show(getMsg('permRequesting'), '');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    // Show a preview as visual confirmation.
    preview.style.display = 'block';
    preview.srcObject = stream;
    show(getMsg('permGranted'), 'ok');
    // Release the camera after a moment: it was only needed to register the permission.
    setTimeout(() => {
      stream.getTracks().forEach((t) => t.stop());
      preview.style.display = 'none';
    }, 1500);
  } catch (e) {
    let hint = e.name;
    if (e.name === 'NotAllowedError') hint = getMsg('permDenied');
    else if (e.name === 'NotFoundError') hint = getMsg('permNoCam');
    else if (e.name === 'NotReadableError') hint = getMsg('permInUse');
    show(getMsg('permErrorPrefix', [hint]), 'err');
  }
});
