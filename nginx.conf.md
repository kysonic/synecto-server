#upstream websocket from node-js channel
upstream websocket {
        ip_hash;
        server 127.0.0.1:3000;
}
upstream io_nodes {
        ip_hash;
        server 127.0.0.1:3000;
}
map $http_upgrade $connection_upgrade {
      default upgrade;
      ''      close;
    }

server {
   listen       80 default_server;
   listen       [::]:80 default_server;
   server_name  server.synecto.io

   include /etc/nginx/default.d/*.conf;

   location / {
        proxy_pass http://127.0.0.1:3000;
   }
   # redirect server error pages to the static page /40x.html
   #
   error_page 404 /404.html;
      location = /40x.html {
   }

   # redirect server error pages to the static page /50x.html
   #
   error_page 500 502 503 504 /50x.html;
       location = /50x.html {
   }

}

    server {
        listen       443 ssl;
        listen       [::]:443 ssl http2;
        server_name  server.designmap.ru;
        client_max_body_size 150m;
#        root         /usr/share/nginx/html;
#
        ssl_certificate "/etc/letsencrypt/live/server.synecto.io/fullchain.pem";
        ssl_certificate_key "/etc/letsencrypt/live/server.synecto.io/privkey.pem";
#        # It is *strongly* recommended to generate unique DH parameters
#        # Generate them with: openssl dhparam -out /etc/pki/nginx/dhparams.pem 2048
#        #ssl_dhparam "/etc/pki/nginx/dhparams.pem";
#        ssl_session_cache shared:SSL:1m;
#        ssl_session_timeout  10m;
        ssl_protocols TLSv1 TLSv1.1 TLSv1.2;
        ssl_ciphers HIGH:SEED:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!RSAPSK:!aDH:!aECDH:!EDH-DSS-DES-CBC3-SHA:!KRB5-DES-CBC3-SHA:!SRP;
#        ssl_prefer_server_ciphers on;
#
#        # Load configuration files for the default server block.
#        include /etc/nginx/default.d/*.conf;
#


       location / {
                proxy_pass http://127.0.0.1:3000;
       }
       location /public {
                root /home/kysonic/synecto/public;
       }
       location /socket.io/ {
            proxy_pass http://websocket;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_redirect off;

            proxy_buffers 8 32k;
            proxy_buffer_size 64k;

            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header Host $http_host;
            proxy_set_header X-NginX-Proxy true;
       }
#
#        error_page 404 /404.html;
#            location = /40x.html {
#        }
#
#        error_page 500 502 503 504 /50x.html;
#            location = /50x.html {
#        }
    }




