'use strict'

const t = require('tap')
const { test, before } = t
const sget = require('simple-get').concat
const fastify = require('..')
const helper = require('./helper')

const sgetForwardedRequest = (app, forHeader, path, protoHeader) => {
  const headers = {
    'X-Forwarded-For': forHeader,
    'X-Forwarded-Host': 'example.com'
  }
  if (protoHeader) {
    headers['X-Forwarded-Proto'] = protoHeader
  }
  sget({
    method: 'GET',
    headers,
    url: 'http://localhost:' + app.server.address().port + path
  }, () => {})
}

const testRequestValues = (t, req, options) => {
  if (options.ip) {
    t.ok(req.ip, 'ip is defined')
    t.equal(req.ip, options.ip, 'gets ip from x-forwarded-for')
  }
  if (options.host) {
    t.ok(req.host, 'host is defined')
    t.equal(req.host, options.host, 'gets host from x-forwarded-host')
    t.ok(req.hostname)
    t.equal(req.hostname, options.host, 'gets hostname from x-forwarded-host')
  }
  if (options.ips) {
    t.same(req.ips, options.ips, 'gets ips from x-forwarded-for')
  }
  if (options.protocol) {
    t.ok(req.protocol, 'protocol is defined')
    t.equal(req.protocol, options.protocol, 'gets protocol from x-forwarded-proto')
  }
  if (options.port) {
    t.ok(req.port, 'port is defined')
    t.equal(req.port, options.port, 'port is taken from x-forwarded-for or host')
  }
}

let localhost
before(async function () {
  [localhost] = await helper.getLoopbackHost()
})

test('trust proxy, not add properties to node req', (t) => {
  t.plan(14)
  const app = fastify({
    trustProxy: true
  })
  app.get('/trustproxy', function (req, reply) {
    testRequestValues(t, req, { ip: '1.1.1.1', host: 'example.com', port: app.server.address().port })
    reply.code(200).send({ ip: req.ip, host: req.host })
  })

  app.get('/trustproxychain', function (req, reply) {
    testRequestValues(t, req, { ip: '2.2.2.2', ips: [localhost, '1.1.1.1', '2.2.2.2'], port: app.server.address().port })
    reply.code(200).send({ ip: req.ip, host: req.host })
  })

  t.teardown(app.close.bind(app))

  app.listen({ port: 0 }, (err) => {
    app.server.unref()
    t.error(err)
    sgetForwardedRequest(app, '1.1.1.1', '/trustproxy')
    sgetForwardedRequest(app, '2.2.2.2, 1.1.1.1', '/trustproxychain')
  })
})

test('trust proxy chain', (t) => {
  t.plan(9)
  const app = fastify({
    trustProxy: [localhost, '192.168.1.1']
  })

  app.get('/trustproxychain', function (req, reply) {
    testRequestValues(t, req, { ip: '1.1.1.1', host: 'example.com', port: app.server.address().port })
    reply.code(200).send({ ip: req.ip, host: req.host })
  })

  t.teardown(app.close.bind(app))

  app.listen({ port: 0 }, (err) => {
    app.server.unref()
    t.error(err)
    sgetForwardedRequest(app, '192.168.1.1, 1.1.1.1', '/trustproxychain')
  })
})

test('trust proxy function', (t) => {
  t.plan(9)
  const app = fastify({
    trustProxy: (address) => address === localhost
  })
  app.get('/trustproxyfunc', function (req, reply) {
    testRequestValues(t, req, { ip: '1.1.1.1', host: 'example.com', port: app.server.address().port })
    reply.code(200).send({ ip: req.ip, host: req.host })
  })

  t.teardown(app.close.bind(app))

  app.listen({ port: 0 }, (err) => {
    app.server.unref()
    t.error(err)
    sgetForwardedRequest(app, '1.1.1.1', '/trustproxyfunc')
  })
})

test('trust proxy number', (t) => {
  t.plan(10)
  const app = fastify({
    trustProxy: 1
  })
  app.get('/trustproxynumber', function (req, reply) {
    testRequestValues(t, req, { ip: '1.1.1.1', ips: [localhost, '1.1.1.1'], host: 'example.com', port: app.server.address().port })
    reply.code(200).send({ ip: req.ip, host: req.host })
  })

  t.teardown(app.close.bind(app))

  app.listen({ port: 0 }, (err) => {
    app.server.unref()
    t.error(err)
    sgetForwardedRequest(app, '2.2.2.2, 1.1.1.1', '/trustproxynumber')
  })
})

test('trust proxy IP addresses', (t) => {
  t.plan(10)
  const app = fastify({
    trustProxy: `${localhost}, 2.2.2.2`
  })
  app.get('/trustproxyipaddrs', function (req, reply) {
    testRequestValues(t, req, { ip: '1.1.1.1', ips: [localhost, '1.1.1.1'], host: 'example.com', port: app.server.address().port })
    reply.code(200).send({ ip: req.ip, host: req.host })
  })

  t.teardown(app.close.bind(app))

  app.listen({ port: 0 }, (err) => {
    app.server.unref()
    t.error(err)
    sgetForwardedRequest(app, '3.3.3.3, 2.2.2.2, 1.1.1.1', '/trustproxyipaddrs')
  })
})

test('trust proxy protocol', (t) => {
  t.plan(31)
  const app = fastify({
    trustProxy: true
  })
  app.get('/trustproxyprotocol', function (req, reply) {
    testRequestValues(t, req, { ip: '1.1.1.1', protocol: 'lorem', host: 'example.com', port: app.server.address().port })
    reply.code(200).send({ ip: req.ip, host: req.host })
  })
  app.get('/trustproxynoprotocol', function (req, reply) {
    testRequestValues(t, req, { ip: '1.1.1.1', protocol: 'http', host: 'example.com', port: app.server.address().port })
    reply.code(200).send({ ip: req.ip, host: req.host })
  })
  app.get('/trustproxyprotocols', function (req, reply) {
    testRequestValues(t, req, { ip: '1.1.1.1', protocol: 'dolor', host: 'example.com', port: app.server.address().port })
    reply.code(200).send({ ip: req.ip, host: req.host })
  })

  t.teardown(app.close.bind(app))

  app.listen({ port: 0 }, (err) => {
    app.server.unref()
    t.error(err)
    sgetForwardedRequest(app, '1.1.1.1', '/trustproxyprotocol', 'lorem')
    sgetForwardedRequest(app, '1.1.1.1', '/trustproxynoprotocol')
    sgetForwardedRequest(app, '1.1.1.1', '/trustproxyprotocols', 'ipsum, dolor')
  })
})
