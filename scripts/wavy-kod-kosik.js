/* ============================================================
   Wavy Boats - kod produktu v KOSIKU
   ------------------------------------------------------------
   Autor: Krystof Glos / glos-optimalizace.cz
   Verze: 1.0 (zadani klienta 2. 10. 2026)

   Pod nazev kazde polozky v kosiku vypise kod produktu a - kde
   existuje - i puvodni kod:

     ADAPTOR
     Kód: 815303T
     Původní kód: 815303

   Dealer si do kosiku casto da vic polozek se stejnym nazvem a bez
   kodu je nerozlisi, aniz by kazdou rozklikl.

   ZDROJ DAT
   - Kod: atribut data-micro-sku na radku kosiku
       <tr data-micro="cartItem" data-micro-sku="815303T">
     U varianty je tam kod VARIANTY (overeno: 1001E031A, viz
     wavy-rrp-kosik.js), takze neni co dohledavat. Vykresluje se
     hned, bez cekani na sit.
   - Puvodni kod: kody.json (jednotky kB, generuje generuj-ceny.py),
     vlastni lehky fetch stejne jako wavy-original-code-katalog.js.
     Vypadek kody.json = zobrazi se jen "Kód", zadna chyba.

   PREKRESLOVANI
   Shoptet po zmene mnozstvi / odebrani polozky prekresli kosik
   AJAXem. Vykresleni je idempotentni (radek s aktualnim boxem se
   preskoci), takze observer muze run() volat libovolne casto -
   po vlozeni boxu dalsi beh uz nic nemeni a smycka se zastavi.

   Vlozeni: Vzhled a obsah -> Editor -> HTML kody -> paticka
   Nezavisi na ostatnich skriptech, poradi nehraje roli.
   ============================================================ */

(function () {
  'use strict';

  /* ================= KONFIGURACE ================= */
  var CONFIG = {
    ROW_SELECTOR: 'tr[data-micro="cartItem"]',
    NAME_CELL_SELECTOR: '.p-name',

    CODE_LABEL: 'Kód:',
    ORIGINAL_LABEL: 'Původní kód:',

    // Puvodni kody - viz hlavicka. Stejny soubor a stejna verze jako
    // v wavy-original-code-katalog.js, aby se sdilela HTTP cache.
    SHOW_ORIGINAL: true,
    CODES_URL: 'https://glos-optimalizace.cz/wavyboats/scripts/kody.json?v=20260824',

    WATCH_CHANGES: true,
    REDRAW_DELAY: 250,

    DEBUG: false
  };

  var BOX_CLASS = 'wb-kod-kosik';
  var STYLE_ID = 'wb-kod-kosik-style';

  function log() {
    if (CONFIG.DEBUG && window.console) {
      console.log.apply(console, ['[kod kosik]'].concat([].slice.call(arguments)));
    }
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    // Sladene s doporucenou cenou v kosiku (12px, #888 / #333).
    // word-break: dlouhe kody nesmi na mobilu roztahnout radek.
    style.textContent =
      '.' + BOX_CLASS + '{margin-top:4px;font-size:12px;line-height:1.4;color:#888;' +
      'word-break:break-all;}' +
      '.' + BOX_CLASS + ' strong{color:#333;font-weight:600;}';
    document.head.appendChild(style);
  }

  /* ================= DATA ================= */

  // Memoizovany fetch kody.json. Po chybe se promise zahodi, aby to
  // dalsi run() zkusil znovu - netrvale se nevzdavat.
  var codesPromise = null;
  var originalCodes = null; // null = jeste nenacteno / nedostupne

  function ensureCodes() {
    if (!CONFIG.SHOW_ORIGINAL) return Promise.resolve(null);
    if (codesPromise) return codesPromise;
    codesPromise = fetch(CONFIG.CODES_URL, { credentials: 'omit' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status + ' - kody.json nedostupny');
        return res.json();
      })
      .then(function (data) {
        originalCodes = data || {};
        return originalCodes;
      })
      .catch(function (err) {
        codesPromise = null;
        throw err;
      });
    return codesPromise;
  }

  /* ================= VYKRESLENI ================= */

  function getRows() {
    return [].slice.call(document.querySelectorAll(CONFIG.ROW_SELECTOR));
  }

  function getSku(row) {
    return (row.getAttribute('data-micro-sku') || '').trim();
  }

  function addLine(box, label, value) {
    var line = document.createElement('div');
    line.appendChild(document.createTextNode(label + ' '));
    var strong = document.createElement('strong');
    strong.textContent = value;
    line.appendChild(strong);
    box.appendChild(line);
  }

  // Vrati true, kdyz se v DOM neco zmenilo.
  function renderRow(row) {
    var sku = getSku(row);
    var cell = row.querySelector(CONFIG.NAME_CELL_SELECTOR);
    if (!sku || !cell) return false;

    var original = (originalCodes && originalCodes[sku]) || '';
    var existing = cell.querySelector('.' + BOX_CLASS);

    // Idempotence: box uz odpovida aktualnimu stavu -> nesahat na DOM
    // (jinak by observer bezel v kruhu).
    if (existing
        && existing.getAttribute('data-sku') === sku
        && existing.getAttribute('data-original') === original) {
      return false;
    }

    var box = document.createElement('div');
    box.className = BOX_CLASS;
    box.setAttribute('data-sku', sku);
    box.setAttribute('data-original', original);
    addLine(box, CONFIG.CODE_LABEL, sku);
    if (original) addLine(box, CONFIG.ORIGINAL_LABEL, original);

    if (existing) {
      existing.parentNode.replaceChild(box, existing);
    } else {
      cell.appendChild(box);
    }
    return true;
  }

  function renderAll() {
    var rows = getRows();
    if (!rows.length) return 0;
    ensureStyle();
    var changed = 0;
    rows.forEach(function (row) {
      if (renderRow(row)) changed++;
    });
    if (changed) log('vykresleno', changed, 'z', rows.length, 'radku');
    return changed;
  }

  function run() {
    if (!getRows().length) return;

    // 1) Kod hned - nezavisi na siti.
    renderAll();

    // 2) Puvodni kody az po nacteni kody.json. Radky se sbiraji
    //    znovu az po fetchi (kosik se mezitim mohl prekreslit).
    if (originalCodes === null) {
      ensureCodes()
        .then(function () { renderAll(); })
        .catch(function (err) {
          log('kody.json se nepodarilo nacist:', err && err.message);
        });
    }
  }

  /* ================= SLEDOVANI ZMEN ================= */

  function watch() {
    if (!CONFIG.WATCH_CHANGES || !window.MutationObserver) return;

    var timer = null;
    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(run, CONFIG.REDRAW_DELAY);
    }

    var observer = new MutationObserver(function (records) {
      // Ignoruj vlastni vlozene prvky.
      for (var i = 0; i < records.length; i++) {
        var t = records[i].target;
        if (t.closest && t.closest('.' + BOX_CLASS)) continue;
        var added = records[i].addedNodes;
        if (added.length === 1 && added[0].classList && added[0].classList.contains(BOX_CLASS)) continue;
        schedule();
        return;
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    ['ShoptetDOMCartItemsUpdated', 'ShoptetDOMCartUpdated', 'ShoptetDOMPageContentLoaded']
      .forEach(function (name) {
        document.addEventListener(name, function () {
          log('event', name);
          schedule();
        });
      });
  }

  /* ================= LADICI API ================= */

  window.WB_KOD_KOSIK = {
    // Na /kosik/ spustit: WB_KOD_KOSIK.debug()
    debug: function () {
      var out = {
        kodyJson: originalCodes === null ? 'nenacteno' : Object.keys(originalCodes).length + ' kodu',
        radky: getRows().map(function (r) {
          var box = r.querySelector('.' + BOX_CLASS);
          return {
            sku: getSku(r),
            puvodni: (originalCodes && originalCodes[getSku(r)]) || null,
            vypsano: box ? box.textContent.replace(/\s+/g, ' ').trim() : null
          };
        })
      };
      if (window.console) {
        console.log('[kod kosik] diagnostika:', out);
        if (console.table) console.table(out.radky);
      }
      return out;
    },
    run: run,
    config: CONFIG
  };

  /* ================= START ================= */

  function init() {
    // Kosik se muze donacist az pozdeji, proto se sleduje i tak.
    run();
    watch();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
