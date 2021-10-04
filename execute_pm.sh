#!/bin/bash

pm2 stop bot1

sleep 1

pm2 stop bot2

sleep 1

pm2 start bot1 --watch

sleep 30

pm2 start bot2 --watch