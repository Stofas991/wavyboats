# Wavy Boats – úpravy Shoptet e-shopu

Skripty a data pro dealerský e-shop Wavy Boats (www.dealerwb.cz).
Repozitář je publikovaný přes GitHub Pages, takže všechno ve `scripts/`
je veřejně dostupné na:

```
https://glos-optimalizace.cz/wavyboats/scripts/<soubor>
```

> Do repozitáře nikdy nepatří nic neveřejného – hash feedu se čte jen
> ze secretu v GitHub Actions a do výstupů se nedostane.

## Skripty pro e-shop

| Soubor | Kde běží | Co dělá |
| --- | --- | --- |
| `wavy-rrp-detail.js` | detail produktu | doporučená cena u produktu a variant |
| `wavy-rrp-kosik.js` | košík | doporučené ceny u řádků a v souhrnu |
| `wavy-kod-kosik.js` | košík | kód produktu (u variant kód varianty) a původní kód pod názvem položky |
| `wavy-original-code-detail.js` | detail produktu | „Původní kód“ vedle kódu produktu |
| `wavy-original-code-katalog.js` | výpis katalogu | „Původní kód“ pod kódem v dlaždicích |
| `wavy-expedice.js` | objednávka, krok 2 | volba dělené expedice |
| `wavy-import-kosiku.js` | košík | import objednávkové tabulky (.xls/.xlsx/.csv) do košíku |

Vkládají se v administraci Shoptetu (Editor HTML kódu) jako
`<script src="https://glos-optimalizace.cz/wavyboats/scripts/....js"></script>`.

## Data

- `scripts/ceny.json` – veřejné ceny podle kódu (zdroj pro RRP skripty)
- `scripts/kody.json` – mapování na původní kódy (katalog, import košíku)

Obojí generuje `scripts/generuj-ceny.py` z exportu `productsComplete.xml`.
Workflow [`.github/workflows/ceny.yml`](.github/workflows/ceny.yml) ho
spouští denně ve 3:00 UTC (a ručně přes „Run workflow“) a změny commitne
zpátky. Potřebuje secret **`WAVY_FEED_HASH`**.

## Pomocné nástroje

- `scripts/test_generuj_ceny.py` – testy generátoru nad malým vzorkem XML
  (`python scripts/test_generuj_ceny.py`)
- `scripts/diagnostika-popisne-parametry.py` – jednorázová diagnostika
  struktury feedu, není součástí pipeline
- `scripts/vyrob-testovaci-tabulku.py` – vyrobí testovací objednávkovou
  tabulku pro `wavy-import-kosiku.js`

## Historie

Do 10/2026 žil tento kód v repozitáři
[Stofas991.github.io](https://github.com/Stofas991/Stofas991.github.io)
pod `https://glos-optimalizace.cz/scripts/`. Historie commitů byla při
oddělení zachována.
