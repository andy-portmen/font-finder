zip -9 -r font-finder.xpi "chrome" "defaults" "install.rdf" "chrome.manifest" -x "*.DS_Store"
wget --post-file=font-finder.xpi http://localhost:8888/
