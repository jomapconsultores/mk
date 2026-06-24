# Landing Marketing MAP — sitio estático servido con nginx.
FROM nginx:1.27-alpine

# Copia las páginas estáticas al directorio que sirve nginx.
COPY index.html politica.html /usr/share/nginx/html/

EXPOSE 80
# nginx:alpine ya define el CMD por defecto (nginx -g 'daemon off;').
