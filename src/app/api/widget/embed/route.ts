import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { origin } = new URL(req.url);

  const js = `(function() {
  var script = document.currentScript;
  var centerId = script.getAttribute('data-center-id');
  if (!centerId) { console.error('SGCC Widget: falta data-center-id'); return; }
  var baseUrl = script.getAttribute('data-url') || '${origin}';

  // Estilos
  var navy = '#0D2340';
  var gold = '#B8860B';

  // Botón flotante
  var btn = document.createElement('div');
  btn.setAttribute('role', 'button');
  btn.setAttribute('tabindex', '0');
  btn.setAttribute('aria-label', 'Solicitar Conciliación');
  btn.innerHTML = '\\u2696\\uFE0F Solicitar Conciliación';
  btn.style.cssText = 'position:fixed;bottom:24px;right:24px;background:' + navy + ';color:white;padding:14px 24px;border-radius:50px;cursor:pointer;font-family:system-ui,-apple-system,sans-serif;font-size:14px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:9999;transition:transform 0.2s,box-shadow 0.2s;user-select:none';
  btn.onmouseover = function() { btn.style.transform = 'scale(1.05)'; btn.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)'; };
  btn.onmouseout = function() { btn.style.transform = 'scale(1)'; btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'; };

  // Overlay
  var overlay = document.createElement('div');
  overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;justify-content:center;align-items:center;padding:16px';

  // Iframe
  var iframe = document.createElement('iframe');
  iframe.src = baseUrl + '/widget/' + centerId;
  iframe.title = 'Solicitar Conciliación';
  iframe.style.cssText = 'width:100%;max-width:640px;height:90vh;border:none;border-radius:16px;background:white;box-shadow:0 20px 60px rgba(0,0,0,0.3)';
  iframe.setAttribute('allow', 'clipboard-write');

  // Botón cerrar
  var closeBtn = document.createElement('div');
  closeBtn.innerHTML = '\\u2715';
  closeBtn.setAttribute('role', 'button');
  closeBtn.setAttribute('tabindex', '0');
  closeBtn.setAttribute('aria-label', 'Cerrar formulario');
  closeBtn.style.cssText = 'position:absolute;top:16px;right:16px;color:white;font-size:24px;cursor:pointer;width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);border-radius:50%;transition:background 0.2s';
  closeBtn.onmouseover = function() { closeBtn.style.background = 'rgba(0,0,0,0.5)'; };
  closeBtn.onmouseout = function() { closeBtn.style.background = 'rgba(0,0,0,0.3)'; };

  overlay.appendChild(iframe);
  overlay.appendChild(closeBtn);

  function open() { overlay.style.display = 'flex'; }
  function close() { overlay.style.display = 'none'; }

  btn.onclick = open;
  btn.onkeydown = function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
  closeBtn.onclick = close;
  closeBtn.onkeydown = function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); close(); } };
  overlay.onclick = function(e) { if (e.target === overlay) close(); };

  // Cerrar con Escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && overlay.style.display === 'flex') close();
  });

  document.body.appendChild(btn);
  document.body.appendChild(overlay);
})();`;

  return new NextResponse(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
