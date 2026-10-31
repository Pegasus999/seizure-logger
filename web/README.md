# Journal des crises — interface web

Site statique (HTML + modules ES + CSS), sans build ni dépendance, interface en français.
Il parle directement à Supabase (auth e-mail/mot de passe + REST). Aucune autre requête réseau.

## Configuration

Un seul fichier : `config.js` (`window.SUPABASE_URL`, `window.SUPABASE_ANON_KEY`).
La clé « publishable » est publique par conception ; la sécurité repose sur les règles RLS de la base.

## Lancer en local

    cd web
    python3 -m http.server 8080      # puis ouvrir http://localhost:8080

Les modules ES exigent HTTP : l'ouverture directe de `index.html` (file://) ne fonctionne pas.

## Déploiement sur un VPS Hetzner avec nginx

1. Copier le dossier : `rsync -av --delete web/ root@VPS:/var/www/journal/` (hors `README.md` si souhaité).
2. Bloc serveur, ex. `/etc/nginx/sites-available/journal` :

        server {
            listen 80;
            server_name journal.example.org;
            root /var/www/journal;
            index index.html;

            add_header X-Content-Type-Options nosniff;
            add_header Referrer-Policy no-referrer;
            # Adapter l'hôte Supabase à config.js :
            add_header Content-Security-Policy "default-src 'self'; connect-src 'self' https://ldpaxsiycotwjjqljufw.supabase.co; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'" always;

            location / { try_files $uri $uri/ =404; }
            location ~* \.(css|js)$ { add_header Cache-Control "no-cache"; }
            gzip on; gzip_types text/css application/javascript;
        }

3. Activer : `ln -s /etc/nginx/sites-available/journal /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx`.
4. HTTPS (obligatoire : données de santé, mots de passe) : `certbot --nginx -d journal.example.org`.
   Certbot ajoute le bloc 443 et la redirection HTTP -> HTTPS.

Le routage est par hash (`#/accueil`), aucune règle de réécriture n'est nécessaire.
