FROM ubuntu:18.04
MAINTAINER Marcelo Fleury "marcelomf@gmail.com"

ENV LANG C.UTF-8
ENV SERVICE_NAME zenbot
ENV SERVICE_VERSION 1

ENV SELECTOR "binance.ETH-BTC"
ENV STRATEGY "mmf"
ENV OPTSZEN "--reverse"

RUN echo "alias ls='ls --color'" >> /etc/profile
RUN apt-get update
RUN ln -s -f /bin/true /usr/bin/chfn
RUN DEBIAN_FRONTEND=noninteractive apt-get upgrade -yq
RUN DEBIAN_FRONTEND=noninteractive apt-get install --fix-missing -yq \
    wget \
    curl \
    git \
    git-core \
    vim \
    g++ \
    build-essential \
    make

RUN apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 9DA31620334BD75D9DCB49F368818C72E52529D4
RUN echo "deb [ arch=amd64 ] https://repo.mongodb.org/apt/ubuntu bionic/mongodb-org/4.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-4.0.list

#RUN add-apt-repository -y ppa:chris-lea/node.js
RUN curl -sL https://deb.nodesource.com/setup_11.x | bash -
RUN apt-get update
RUN DEBIAN_FRONTEND=noninteractive apt-get install --fix-missing -yq \
    nodejs \
    node-gyp \
    mongodb-org

RUN mkdir -p /opt/$SERVICE_NAME
ADD . /opt/$SERVICE_NAME
WORKDIR /opt

#RUN npm update
RUN cd /opt/$SERVICE_NAME && npm install || echo "error bypass"

#RUN service mongodb start
#RUN systemctl start mongod.service
#RUN systemctl enable mongod.service
RUN mkdir -p /data/db

WORKDIR zenbot

RUN groupadd -r $SERVICE_NAME
RUN useradd -r -s /bin/sh -d /opt/$SERVICE_NAME -c 'service user' -g $SERVICE_NAME $SERVICE_NAME

ENTRYPOINT ["/opt/zenbot/./dockerized.sh"]
#CMD [ ]
