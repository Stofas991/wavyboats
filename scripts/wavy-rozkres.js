/*
 * WB klikací výkres – POC pro Shoptet (dealerwb.cz)
 *
 * Vložit do: Vzhled a obsah > Editor > HTML kód > Zápatí (hotový blok je v shoptet-zapati.html)
 *
 * V popisu kategorie / produktu pak stačí:
 *   <div class="wb-vykres">
 *     <img src="URL-VYKRESU" alt="Kryt motoru">
 *     <p class="wb-vykres-data">002;8M0043151;67;33.4 | 003;13691A02;55;62.5 | ...</p>
 *   </div>
 * Řádek dat = pozice;kód produktu v Shoptetu;X v %;Y v % (od levého horního rohu obrázku)
 *   a volitelně ;dílX;dílY = kde ve výkresu leží samotný díl (náhled se na něj zaměří, když díl nemá fotku)
 *   a ;přiblížení výřezu (výchozí 2.5, velké díly např. 0.8).
 * Kód "-" = díl se už nedodává (červený bod).
 */
(function () {
  'use strict';

  var CSS = [
    '.wb-vykres{position:relative;max-width:1000px;margin:20px auto;font-family:inherit}',
    '.wb-vykres-stage{position:relative;container-type:inline-size}',
    '.wb-vykres-stage img{display:block;width:100%;height:auto}',
    '.wb-vykres-data{display:none}',
    // Velikost bodů se řídí šířkou výkresu, aby se na úzkém sloupci / mobilu nepřekrývaly.
    '.wb-hs{position:absolute;transform:translate(-50%,-50%);width:clamp(16px,3.2cqw,30px);aspect-ratio:1;border-radius:50%;',
    '  display:flex;align-items:center;justify-content:center;',
    '  border:0;padding:0;font:600 clamp(8px,1.15cqw,11px)/1 Arial,sans-serif;cursor:pointer;color:#111;',
    '  background:#9e9e9e;box-shadow:0 1px 3px rgba(0,0,0,.35);transition:transform .15s}',
    '.wb-hs:hover,.wb-hs.is-active{transform:translate(-50%,-50%) scale(1.25);z-index:3}',
    '.wb-hs.is-ok{background:#5ee35e}',
    '.wb-hs.is-out{background:#f29b9b;cursor:default}',
    '.wb-hs.is-loading{opacity:.5}',
    '.wb-pop{position:absolute;z-index:10;width:260px;background:#fff;border:1px solid #ddd;border-radius:6px;',
    '  box-shadow:0 6px 24px rgba(0,0,0,.18);padding:12px;transform:translate(-50%,calc(-100% - 22px));font-size:13px}',
    '.wb-pop:after{content:"";position:absolute;left:50%;bottom:-8px;margin-left:-8px;border:8px solid transparent;border-bottom:0;border-top-color:#fff}',
    '.wb-pop.is-below{transform:translate(-50%,22px)}',
    '.wb-pop.is-below:after{bottom:auto;top:-8px;border-top:0;border-bottom:8px solid #fff}',
    '.wb-pop-close{position:absolute;right:6px;top:2px;border:0;background:none;font-size:18px;cursor:pointer;color:#777;z-index:1}',
    '.wb-pop-img{position:relative;height:120px;margin:4px 0 8px;border:1px solid #eee;border-radius:4px;overflow:hidden;background:#fff}',
    '.wb-pop-img img{display:block;width:100%;height:100%;object-fit:contain}',
    '.wb-pop-img img.wb-crop{position:absolute;width:auto;height:auto;max-width:none;object-fit:fill}',
    '.wb-pop-img span{position:absolute;right:4px;bottom:2px;font-size:10px;color:#888;background:rgba(255,255,255,.85);padding:0 3px}',
    '.wb-pop-pos{color:#777;font-size:11px}',
    '.wb-pop-name{display:block;font-weight:700;margin:2px 18px 4px 0;color:#111}',
    '.wb-pop-code{color:#555;font-size:12px}',
    '.wb-pop-price{font-size:16px;font-weight:700;margin:6px 0 2px}',
    '.wb-pop-price small{font-size:11px;font-weight:400;color:#666;margin-left:6px}',
    '.wb-pop-buy{display:flex;gap:6px;margin-top:8px}',
    '.wb-pop-buy input{width:56px;padding:4px;border:1px solid #ccc;border-radius:4px}',
    '.wb-pop-buy button{flex:1;border:0;border-radius:4px;background:#000;color:#fff;font-weight:700;cursor:pointer;padding:6px}',
    '.wb-legend{font-size:12px;color:#555;margin:8px 0}',
    '.wb-legend i{display:inline-block;width:12px;height:12px;border-radius:50%;vertical-align:-2px;margin:0 4px 0 10px}',
    '.wb-table{width:100%;border-collapse:collapse;font-size:13px;margin-top:10px}',
    '.wb-table th,.wb-table td{border-bottom:1px solid #eee;padding:6px 8px;text-align:left}',
    '.wb-table tr.is-hl{background:#fff7d6}',
    '.wb-table td.num{text-align:right;white-space:nowrap}',
    '.wb-table .wb-add{border:0;background:#000;color:#fff;border-radius:4px;padding:4px 10px;cursor:pointer}',
    '@media (max-width:600px){.wb-pop{width:220px}}'
  ].join('\n');

  var cache = {};

  // Najde produkt podle přesného kódu přes vyhledávání Shoptetu (stejná doména, bez API klíče).
  function fetchProduct(code) {
    if (!cache[code]) {
      cache[code] = fetch('/vyhledavani/?string=' + encodeURIComponent(code), { credentials: 'same-origin' })
        .then(function (r) { return r.text(); })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var cards = doc.querySelectorAll('.product .p');
          for (var i = 0; i < cards.length; i++) {
            var p = cards[i];
            var m = p.textContent.match(/Kód:\s*(\S+)/);
            if (!m || m[1].toUpperCase() !== code.toUpperCase()) continue;
            var link = p.querySelector('a.name');
            var priceId = p.querySelector('input[name="priceId"]');
            var avail = p.querySelector('.availability');
            var priceFinal = p.querySelector('.price-final');
            var priceNet = p.querySelector('.price-additional');
            var photo = p.querySelector('a.image img');
            var photoSrc = photo ? (photo.getAttribute('data-src') || photo.getAttribute('src') || '').trim() : '';
            return {
              // Zástupný obrázek Shoptetu ("missing_images") nebereme jako fotku.
              image: photoSrc && photoSrc.indexOf('missing_images') === -1 ? photoSrc : null,
              code: m[1],
              name: link ? link.textContent.trim() : code,
              url: link ? link.getAttribute('href') : null,
              priceId: priceId ? priceId.value : null,
              price: priceFinal ? priceFinal.textContent.replace(/\s+/g, ' ').trim() : '',
              priceNet: priceNet ? priceNet.textContent.replace(/\s+/g, ' ').trim() : '',
              availability: avail ? avail.textContent.trim() : ''
            };
          }
          return null;
        })
        .catch(function () { return null; });
    }
    return cache[code];
  }

  function parseData(text) {
    return text.split(/[|\n]/).map(function (row) {
      var c = row.split(';').map(function (s) { return s.trim(); });
      if (c.length < 4) return null;
      // Nepovinné 5. a 6. pole = kde ve výkresu leží samotný díl (pro výřez v náhledu).
      // 7. pole = přiblížení výřezu (výchozí 2.5; velké díly např. 0.8, aby byly vidět celé).
      var px = parseFloat(c[4]), py = parseFloat(c[5]), zoom = parseFloat(c[6]);
      return { pos: c[0], code: c[1] === '-' ? null : c[1], x: parseFloat(c[2]), y: parseFloat(c[3]),
        px: isNaN(px) ? null : px, py: isNaN(py) ? null : py, zoom: isNaN(zoom) ? null : zoom };
    }).filter(Boolean);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  // Náhled dílu: fotka z e-shopu, a když chybí, zvětšený výřez výkresu kolem bodu.
  function previewHtml(product, pt, drawing) {
    if (product.image) {
      return '<div class="wb-pop-img"><img src="' + esc(product.image) + '" alt="' + esc(product.name) + '"></div>';
    }
    if (!drawing.naturalWidth) return '';
    var ZOOM = pt.zoom || 2.5;
    var cx = pt.px != null ? pt.px : pt.x, cy = pt.py != null ? pt.py : pt.y;
    // Vnitřní šířka okna (260 px, na mobilu 220 px, minus padding) × výška náhledu.
    var boxW = (window.innerWidth <= 600 ? 220 : 260) - 24, boxH = 120;
    var imgW = drawing.clientWidth * ZOOM;
    var imgH = imgW * drawing.naturalHeight / drawing.naturalWidth;
    var left = boxW / 2 - cx / 100 * imgW;
    var top = boxH / 2 - cy / 100 * imgH;
    return '<div class="wb-pop-img"><img class="wb-crop" src="' + esc(drawing.currentSrc || drawing.src) + '" alt="" ' +
      'style="width:' + imgW + 'px;height:' + imgH + 'px;left:' + left + 'px;top:' + top + 'px"><span>výřez z rozkresu</span></div>';
  }

  function addToCart(product, amount, btn) {
    if (!product.priceId || !window.shoptet || !shoptet.cartShared) {
      window.location.href = product.url;
      return;
    }
    // Shoptet při simple_ajax_cart nic nezobrazí, potvrzení dáme přímo do tlačítka.
    var label = btn.textContent;
    btn.disabled = true;
    shoptet.cartShared.addToCart({ priceId: product.priceId, amount: amount || 1 });
    btn.textContent = 'Přidáno ✓';
    setTimeout(function () { btn.disabled = false; btn.textContent = label; }, 2000);
  }

  function init(root) {
    if (root.dataset.wbReady) return;
    root.dataset.wbReady = '1';

    var img = root.querySelector('img');
    var dataEl = root.querySelector('.wb-vykres-data');
    if (!img || !dataEl) return;
    var points = parseData(dataEl.textContent);

    var stage = document.createElement('div');
    stage.className = 'wb-vykres-stage';
    img.parentNode.insertBefore(stage, img);
    stage.appendChild(img);

    var legend = document.createElement('div');
    legend.className = 'wb-legend';
    legend.innerHTML = 'Klikněte na číslo dílu:<i style="background:#5ee35e"></i>lze objednat<i style="background:#f29b9b"></i>nedodává se';
    root.insertBefore(legend, stage);

    var table = document.createElement('table');
    table.className = 'wb-table';
    table.innerHTML = '<thead><tr><th>Poz.</th><th>Kód</th><th>Název</th><th>Dostupnost</th><th class="num">Cena</th><th></th></tr></thead><tbody></tbody>';
    root.appendChild(table);
    var tbody = table.querySelector('tbody');

    var pop = null;
    function closePop() {
      if (pop) pop.remove();
      pop = null;
      root.querySelectorAll('.wb-hs.is-active,.wb-table tr.is-hl').forEach(function (el) { el.classList.remove('is-active', 'is-hl'); });
    }

    points.forEach(function (pt) {
      var hs = document.createElement('button');
      hs.type = 'button';
      hs.className = 'wb-hs is-loading';
      hs.textContent = pt.pos;
      hs.style.left = pt.x + '%';
      hs.style.top = pt.y + '%';
      stage.appendChild(hs);

      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + esc(pt.pos) + '</td><td>' + esc(pt.code || '–') + '</td><td>…</td><td></td><td class="num"></td><td></td>';
      tbody.appendChild(tr);

      var ready = pt.code ? fetchProduct(pt.code) : Promise.resolve(null);
      ready.then(function (product) {
        hs.classList.remove('is-loading');
        hs.classList.add(product ? 'is-ok' : 'is-out');
        if (!product) {
          hs.title = 'Díl se již nedodává';
          tr.cells[2].textContent = 'Nedodává se';
          return;
        }
        tr.cells[2].innerHTML = '<a href="' + esc(product.url) + '">' + esc(product.name) + '</a>';
        tr.cells[3].textContent = product.availability;
        tr.cells[4].textContent = product.price;
        var addBtn = document.createElement('button');
        addBtn.className = 'wb-add';
        addBtn.type = 'button';
        addBtn.textContent = 'Do košíku';
        addBtn.addEventListener('click', function () { addToCart(product, 1, addBtn); });
        tr.cells[5].appendChild(addBtn);

        hs.addEventListener('click', function (e) {
          e.stopPropagation();
          var wasActive = hs.classList.contains('is-active');
          closePop();
          if (wasActive) return;
          hs.classList.add('is-active');
          tr.classList.add('is-hl');
          pop = document.createElement('div');
          // U horních bodů otevřít okno pod bodem a vodorovně ho držet uvnitř výkresu.
          pop.className = 'wb-pop' + (pt.y < 35 ? ' is-below' : '');
          pop.style.left = 'clamp(110px,' + pt.x + '%,calc(100% - 110px))';
          pop.style.top = pt.y + '%';
          pop.innerHTML =
            '<button type="button" class="wb-pop-close" aria-label="Zavřít">×</button>' +
            '<span class="wb-pop-pos">Pozice ' + esc(pt.pos) + '</span>' +
            previewHtml(product, pt, img) +
            '<a class="wb-pop-name" href="' + esc(product.url) + '">' + esc(product.name) + '</a>' +
            '<span class="wb-pop-code">Kód: ' + esc(product.code) + ' · ' + esc(product.availability) + '</span>' +
            '<div class="wb-pop-price">' + esc(product.price) + '<small>' + esc(product.priceNet) + '</small></div>' +
            '<div class="wb-pop-buy"><input type="number" min="1" value="1" aria-label="Počet kusů"><button type="button">Do košíku</button></div>';
          pop.addEventListener('click', function (ev) { ev.stopPropagation(); });
          pop.querySelector('.wb-pop-close').addEventListener('click', closePop);
          var buy = pop.querySelector('.wb-pop-buy button');
          buy.addEventListener('click', function () {
            addToCart(product, parseInt(pop.querySelector('input').value, 10) || 1, buy);
          });
          stage.appendChild(pop);
        });
      });
    });

    document.addEventListener('click', closePop);
  }

  function run() {
    if (!document.getElementById('wb-vykres-css')) {
      var style = document.createElement('style');
      style.id = 'wb-vykres-css';
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    document.querySelectorAll('.wb-vykres').forEach(init);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
  window.wbVykresInit = run;
})();
