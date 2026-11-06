# Box In Stock: US Economic Outlook

Static dashboard of the indicators that best predict the direction of the US economy:
the yield curve, jobless claims, credit spreads, the Sahm rule and more.

Live at **https://boxinstock.com**.

> The figures are currently illustrative sample values. Live data from FRED is planned.

## Layout

```
public/      Everything here is served as-is. Nothing outside it is public.
  index.html The whole page: HTML, CSS and JavaScript in one file
```

## Deploying

The server's Caddy serves `public/` straight from this checkout, so deploying is just updating the files:

```bash
cd ~/sites/boxinstock && git pull
```

No build step and no restart. To preview locally, open `public/index.html` in a browser.
