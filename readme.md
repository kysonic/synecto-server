#####################
>>>>>>DESIGNMAP<<<<<<
#####################

FullStack Developer|Admin|Ui: Miroshnichenko Anton
Design|Ui: Pererva Elena

All rights reserved.

Designmap is a tool for web-designers.It helps design artists and their clients to
find a way of communication, mutual working and storing data.

Server-side requirements:

1. Node.js >=4
2. Image Magick >=7
3. Graphics Magick >6 [not necessary]
4. Ghost script >9

## Before start

run 


    http://localhost:4000/acl to setup ACL schema
    http://localhost:4000/acl/default 


LETSENCRYPT:

https://coderwall.com/p/e7gzbq/https-with-certbot-for-nginx-on-amazon-linux

certbot is already installed:

    /usr/local/bin - certbot-auto

To make renew of certificate:

    ./certbot-auto renew --dry-run --debug

To make new one if it will be needed:

   ./certbot-auto certonly --standalone -d server.designmap.ru --debug

The folder of letsencrypt:

   /etc/letsencrypt/...

ssh -i ~/.ssh/designmap-server.pem ec2-user@ec2-52-59-115-60.eu-central-1.compute.amazonaws.com
cd /var/www/server
sudo su
git pull origin master
npm i
service designmap restart


Short url for updates/latest

mac = https://goo.gl/Katxui
win = https://goo.gl/S32PcA





