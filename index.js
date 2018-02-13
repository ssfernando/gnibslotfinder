const fetch = require('node-fetch')
const mail = require('nodemailer')
const notifier = require('node-notifier')

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'

const URL_CHECK_SLOTS =
  'https://burghquayregistrationoffice.inis.gov.ie/Website/AMSREG/AMSRegWeb.nsf/(getApps4DTAvailability)?openpage&&cat=Work&sbcat=All&typ=Renewal'

const RESTART_TIME = 3000
const SERVICE = 'Gmail'
const USER = '*****'
const PASSWORD = '*****'
const FROM = 'GNIB NODE APP'
const TO = 'ssfernando.luiz@gmail.com'
const SUBJECT = 'GNIB APPOINTMENT'

let datesAvailable = []

function Deferred() {
  this.promise = new Promise((resolve, reject) => {
    this.resolve = resolve
    this.reject = reject
  })
}

function start() {
  fetch(URL_CHECK_SLOTS)
    .then(res => res.json())
    .then(getSlots)
    .then(logMessage)
    .then(notify)
    .then(restart)
    .catch(onError)
}

function getSlots(json) {
  return typeof json.slots === 'string' ? JSON.parse(json.slots) : json.slots
}

function logMessage(slots) {
  const message = getLogMessage(slots)

  console.info(new Date(), message)

  return slots
}

async function notify(slots) {
  const shouldNotify = slots.length > 0 && didSlotsChanged(slots)

  if (shouldNotify) {
    await Promise.all([sendDesktopNotification(slots), sendEmail(slots)])
  }

  return slots
}

function onError(err) {
  console.error(err)
  restart()
}

function didSlotsChanged(slots) {
  return slots.toString() !== datesAvailable.toString()
}

function getLogMessage(slots) {
  return slots.length > 0
    ? `Dates found: ${JSON.stringify(slots)}`
    : 'No dates available at the moment'
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
