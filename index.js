const fetch = require('node-fetch')
const mail = require('nodemailer')
const notifier = require('node-notifier')

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'

const URL_CHECK_SLOTS =
  'https://burghquayregistrationoffice.inis.gov.ie/Website/AMSREG/AMSRegWeb.nsf/(getApps4DTAvailability)?readform&&cat=Study&sbcat=All&typ=New'
let k = '00000000000000000000000000000000'
let p = '00000000000000000000000000000000'

const RESTART_TIME = 3000
const SERVICE = 'Gmail'
const USER = '{SENDER_EMAIL}'
const PASSWORD = '{SENDER_EMAIL_PASSWORD}'
const FROM = 'GNIB NODE APP'
const TO = '{RECEIVER_EMAILS}'
const SUBJECT = 'GNIB APPOINTMENT'
const K_TAG = '<input id="k" type="hidden" value="'
const P_TAG = '<input id="p" type="hidden" value="'
const headers = {
  Host: 'burghquayregistrationoffice.inis.gov.ie',
  'User-Agent':
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:62.0) Gecko/20100101 Firefox/62.0',
  Accept: 'application/json, text/javascript, */*; q=0.01',
  Referer:
    'https://burghquayregistrationoffice.inis.gov.ie/Website/AMSREG/AMSRegWeb.nsf/AppSelect?OpenForm',
  'X-Requested-With': 'XMLHttpRequest',
  Cookie:
    '_ga=GA1.3.1378869052.1536830642; _gid=GA1.3.1590764695.1537783699; cookieconsent_status=dismiss',
  Connection: 'keep-alive',
}

let datesAvailable = []

function Deferred() {
  this.promise = new Promise((resolve, reject) => {
    this.resolve = resolve
    this.reject = reject
  })
}

function start() {
  fetch(URL_CHECK_SLOTS + `&k=${k}` + `&p=${p}`, { method: 'GET', headers })
    .then(res => res.json())
    .then(getSlots)
    .then(isSessionExpired)
    .then(logMessage)
    .then(notify)
    .then(restart)
    .catch(onError)
}

function getSlots(json) {
  return typeof json.slots === 'string' ? JSON.parse(json.slots) : json.slots
}

async function isSessionExpired(slots) {
  return slots !== undefined ? slots : await getNewTokens()
}

function logMessage(slots) {
  const message = getLogMessage(slots)

  console.info(new Date(), message)

  return slots
}

async function notify(slots) {
  const shouldNotify = slots.length > 0 && didSlotsChanged(slots)

  if (shouldNotify) {
    // await Promise.all([sendDesktopNotification(slots), sendEmail(slots)])
    await sendDesktopNotification(slots)
  }

  return slots
}

async function onError(err) {
  console.error(err)

  restart()
}

async function getNewTokens() {
  let keep = true

  while (keep) {
    try {
      const response = await fetch(
        'https://burghquayregistrationoffice.inis.gov.ie/Website/AMSREG/AMSRegWeb.nsf/AppSelect?OpenForm'
      )
      const page = await response.text()

      const { newK, newP } = getKayAndPiTokensFromPage(page)

      k = newK
      p = newP

      keep = false
    } catch (err) {}
  }

  console.info('Tokens expired, restarting with new tokens!')

  await notifySessionExpired()

  return []
}

function getLogMessage(slots) {
  return slots.length > 0
    ? `Dates found: ${JSON.stringify(slots)}`
    : 'No dates available at the moment'
}

function didSlotsChanged(slots) {
  return slots.toString() !== datesAvailable.toString()
}

function sendDesktopNotification(slots) {
  const deferred = new Deferred()

  notifier.notify(
    {
      title: 'Date found',
      message: JSON.stringify(slots),
    },
    err => {
      if (err) deferred.reject(err)
      else deferred.resolve()
    }
  )

  return deferred.promise
}

async function sendEmail(slots) {
  const options = getMailOptions(JSON.stringify(slots))

  try {
    const info = await createMailTransport().sendMail(options)

    console.info(
      'Email with available dates sent: %s %s',
      info.messageId,
      info.response
    )
  } catch (e) {
    throw e
  }
}

function restart(slots = []) {
  datesAvailable = slots
  const timeout = setTimeout(() => {
    start()
    clearTimeout(timeout)
  }, RESTART_TIME)
}

function getKayAndPiTokensFromPage(page) {
  const kStartIndex = page.lastIndexOf(K_TAG) + K_TAG.length
  const pStartIndex = page.lastIndexOf(P_TAG) + P_TAG.length
  const newK = page.substring(kStartIndex, kStartIndex + k.length)
  const newP = page.substring(pStartIndex, pStartIndex + p.length)

  return { newK, newP }
}

function notifySessionExpired() {
  const deferred = new Deferred()

  notifier.notify(
    {
      title: 'Session expired',
      message: 'Refresh the Appointment page',
    },
    err => {
      if (err) deferred.reject(err)
      else deferred.resolve()
    }
  )

  return deferred.promise
}

function getMailOptions(text) {
  const options = {
    from: FROM,
    to: TO,
    subject: SUBJECT,
    text: text,
  }

  return options
}

function createMailTransport() {
  return mail.createTransport({
    service: SERVICE,
    auth: {
      user: USER,
      pass: PASSWORD,
    },
  })
}

start()
