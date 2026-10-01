DISPLAY_NAME=NinWiki Web
DESCRIPTION=Frontend Next.js do NinWiki
MAIN=package.json
MEMORY=1024
VERSION=recommended
SUBDOMAIN=ninwiki
START=npm run build && npx next start -p 80 -H 0.0.0.0
