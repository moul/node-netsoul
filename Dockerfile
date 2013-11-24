FROM ubuntu
MAINTAINER Manfred Touron m@42.am

RUN apt-get install -y python-software-properties python
RUN add-apt-repository ppa:chris-lea/node.js
RUN echo "deb http://archive.ubuntu.com/ubuntu/ precise main universe" >> /etc/apt/sources.list
RUN apt-get -q -y update
RUN apt-get install -q -y nodejs
RUN mkdir /app /node_modules
RUN cd /app; npm install crypto

ADD . /app
RUN cd /app; npm install --production
RUN chown -R nobody /app

USER nobody
WORKDIR /app
ENTRYPOINT ["/usr/bin/node", "examples/simple_client_tcp.js"]
#CMD ["/usr/bin/node", "examples/simple_client_tcp.js"] 
