#!/usr/bin/env bash

while sleep 30; do 
    result=$(wget -qO- --no-check-certificate --header="Cookie:_ga=GA1.3.1378869052.1536830642; _gid=GA1.3.1590764695.1537783699" "https://burghquayregistrationoffice.inis.gov.ie/Website/AMSREG/AMSRegWeb.nsf/(getAppsNear)?readform&cat=Study&sbcat=All&typ=New&k=B1D06D69E7ACDAC85152C29738E7C820&p=82749B57AB0FBFF8D8EF3A599581B30A&_=1537795964552")
    if [ "$result" == "{\"empty\":\"TRUE\"}" ]
    then
        echo "No dates available"
    else 
        notify-send "Date" "$result"
    fi
done;