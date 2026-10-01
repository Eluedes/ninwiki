DISPLAY_NAME=NinWiki Web
DESCRIPTION=Frontend Next.js do NinWiki
MAIN=server.js
MEMORY=512
VERSION=recommended
SUBDOMAIN=ninwiki
START=HOSTNAME=0.0.0.0 PORT=80 node --env-file=.env server.js
