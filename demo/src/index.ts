import {
  createSpeexWorkletNode,
  loadRnnoise,
  createRnnoiseWorkletNode,
  createNoiseGateWorkletNode
} from '@sapphi-red/web-noise-suppressor'
import speexWorkletPath from '@sapphi-red/web-noise-suppressor/dist/speex/workletProcessor?url'
import noiseGateWorkletPath from '@sapphi-red/web-noise-suppressor/dist/noiseGate/workletProcessor?url'
import rnnoiseWorkletPath from '@sapphi-red/web-noise-suppressor/dist/rnnoise/workletProcessor?url'
import { setupVisualizer } from './visualizer'
import { fetchArrayBuffer } from './utils'

//
;(async () => {
  const ctx = new AudioContext()

  console.log('1: Setup...')
  const speexWasmBinary = await fetchArrayBuffer('/wasms/speex.wasm')
  const rnnoiseWasmBinary = await loadRnnoise({
    path: '/wasms/rnnoise.wasm',
    simdPath: '/wasms/rnnoise_simd.wasm'
  })
  await ctx.audioWorklet.addModule(speexWorkletPath)
  await ctx.audioWorklet.addModule(noiseGateWorkletPath)
  await ctx.audioWorklet.addModule(rnnoiseWorkletPath)
  console.log('1: Setup done')

  const $startButton = document.getElementById(
    'start-button'
  ) as HTMLButtonElement
  const $form = document.getElementById('form') as HTMLFormElement

  const $canvas = document.getElementById('canvas') as HTMLCanvasElement
  const analyzer = setupVisualizer($canvas, ctx)

  let speex: AudioWorkletNode | undefined
  let rnnoise: AudioWorkletNode | undefined
  let noiseGate: AudioWorkletNode | undefined
  let gain: GainNode | undefined
  $form.addEventListener('submit', async e => {
    e.preventDefault()
    $startButton.disabled = true
    ctx.resume()

    const formData = new FormData($form)
    const type = formData.get('type')
    const webRtcNoiseSuppression = formData.has('webrtc-noise')
    const webRtcEchoCancellation = formData.has('webrtc-echo')
    const enableVisualizer = formData.has('visualizer')

    console.log('2: Loading...')
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        noiseSuppression: webRtcNoiseSuppression,
        echoCancellation: webRtcEchoCancellation,
        autoGainControl: false
      }
    })
    const source = ctx.createMediaStreamSource(stream)
    console.log('2: Loaded')

    console.log('3: Start')
    speex?.disconnect()
    rnnoise?.disconnect()
    noiseGate?.disconnect()
    gain?.disconnect()
    speex = createSpeexWorkletNode(ctx, speexWasmBinary, { channels: 2 }).node
    rnnoise = createRnnoiseWorkletNode(ctx, rnnoiseWasmBinary, {
      channels: 2
    }).node
    const noiseGateO = createNoiseGateWorkletNode(ctx, {
      openThreshold: -50,
      closeThreshold: -60,
      hold: 30,
      channels: 2
    })
    noiseGate = noiseGateO.node
    gain = new GainNode(ctx, { gain: 1 })

    if (type === 'speex') {
      source.connect(speex)
      speex.connect(gain)
    } else if (type === 'rnnoise') {
      source.connect(rnnoise)
      rnnoise.connect(gain)
    } else if (type === 'noiseGate') {
      source.connect(noiseGate)
      noiseGate.connect(gain)
    } else {
      source.connect(gain)
    }

    analyzer.disconnect()
    if (enableVisualizer) {
      gain.connect(analyzer)
    }

    gain.connect(ctx.destination)

    $startButton.disabled = false
  })

  $startButton.disabled = false
})()
