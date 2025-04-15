import mqtt from 'mqtt'

class MqttClient {
  constructor() {
    this.client = null
    this.callbacks = new Map()
  }

  connect(brokerUrl, options) {
    this.client = mqtt.connect(brokerUrl, options)

    this.client.on('connect', () => {
      console.log('Connected to MQTT broker')
    })

    this.client.on('message', (topic, message) => {
      console.log('message',topic);
      
      const callback = this.callbacks.get(topic)
      if (callback) {
        callback(message.toString())
      }
    })

    this.client.on('error', (error) => {
      console.error('MQTT error:', error)
    })
  }

  subscribe(topic, callback) {
    this.client.subscribe(topic, (err) => {
      if (!err) {
        this.callbacks.set(topic, callback)
        console.log(`Subscribed to ${topic}`)
      }
    })
  }

  publish(topic, message) {
    this.client.publish(topic, message)
  }

  disconnect() {
    this.client.end()
  }
}

export default new MqttClient()