## Dev OPS

Hey. Here i gonna describe all steps to spin up new server on Google Cloud Platform. This knowledge will be required when
we will start to develop big environment for app.synecto.io.

### Registration of AWS account.

- Create new google account.
- Go to aws.amazon.com and click "Create new account"
- Fill out all fields including credit card. Card should have at least 1$ for checking.
- Credit card region will affect on AWS regions. So if you want server in San Francisco you have to find US card.
- Enter pin by your phone during an automated call.


## Google cloud platform

### Ubuntu 16 04

1. Spin up environment

    - sudo apt-get update
    - apt-get install git

    - install NVM [https://www.liquidweb.com/kb/how-to-install-nvm-node-version-manager-for-node-js-on-ubuntu-14-04-lts/]
    - nvm install v7.10.0

    - sudo apt-get install nginx

    - install mongo db [https://www.digitalocean.com/community/tutorials/mongodb-ubuntu-16-04-ru]

2. Install certbot

    - https://certbot.eff.org/#ubuntuxenial-nginx
    - run sudo certbot --nginx

3. Demon for nodejs

    - sudo apt-get install upstart
    - sudo vim /etc/init/synecto.conf
    ///
    - create ./synecto.sh [content from service.md]

4. Assets [image magick]

    - sudo apt-get install imagemagick
    - sudo apt-get install ghostscript


###Create DB User

use admin

db.createUser(
{
    user: "root",
    pwd: "password",
    roles: [ "root" ]
})

db.createUser({ user: "synecto" , pwd: "m0a0sccc", roles: [  { role: "readWrite", db: "synecto" }]})

## Database -> MONGODB

https://www.digitalocean.com/community/tutorials/mongodb-ubuntu-16-04-ru

## Google Cloud ->

Don't forget to add internal insntance address in bindIp mongodb configuration.

###MongoDb dump

mongodump -h 52.59.115.60 --port 27017 -d 'designmap' -u 'kysonic' -p 'ioioioiooio'  --out /Users/kysonic/WebDevelopments/CDC/designmap-server/dump
mongorestore -h 35.196.133.237 --port 27017 -d 'synecto' -u 'kysonic' -p 'ioioioioi' --dir /Users/kysonic/WebDevelopments/CDC/designmap-server/dump/designmap
mongorestore -d 'synecto' --dir /home/kysonic/dump

###Cron MongoDump

mongodump -d 'synecto' --out /home/kysonic/dump


####

db.users.update({'local.email':'soooyc@yandex.ru'},{$set:{plan:{name:'agency',teamMembers:5,storage:5000,price:15,expired:new Date(2017, 16, 8),upload:0,gumid:'QdqjMJcQKR4guzpM71NoDg=='}}})


###Deploy

gcloud compute --project "designmap-1217" ssh --zone "us-east1-c" "server-synecto"
sudo su
cd /home/kysonic/synecto
git pull origin master
nvm use v7.10 (?)
npm i
./synecto.sh restart
