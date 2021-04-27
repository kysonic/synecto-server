#!/bin/sh

#
# chkconfig: 35 99 99
# description: Node.js /var/www/server/bin/www
#

. /lib/lsb/init-functions

USER="root"

DAEMON="node"

ROOT_DIR="/home/kysonic/synecto/"

SERVER="/home/kysonic/synecto/bin/www"

LOCK_FILE="/home/kysonic/lock"

do_start()
{
        echo -n $'Designmap start                                           [OK]\n'
        nohup $DEAMON $SERVER &
}
do_stop()
{
        echo -n $'Designmap stop                                           [OK]\n'
        pid=`ps -aefw | grep "$DAEMON" | grep -v " grep " | awk '{print $2}'`
        kill -9 $pid
        RETVAL=$?
        echo -n
        [ $RETVAL -eq 0 ] && rm -f $LOCK_FILE
}

case "$1" in
        start)
                do_start
                ;;
        stop)
                do_stop
                ;;
        restart)
                do_stop
                do_start
                ;;
        *)
                echo "Usage: $0 {start|stop|restart}"
                RETVAL=1
esac

exit $RETVAL

