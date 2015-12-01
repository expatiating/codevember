global.THREE = require('three')
const createOrbit = require('./three-orbit-app')

const classes = require('dom-classes')
const audioPlayer = require('web-audio-player')
const createReverb = require('soundbank-reverb')
const createBackground = require('./gl/three-vignette-background')
const tweenr = require('tweenr')()
const average = require('analyser-frequency-average')
const audioAnalyser = require('web-audio-analyser')

import {
  mainColor, altColor,
  updateBackground,
  createStars,
  createAsteroids,
  createPlanet
} from './gl/30-scene'

const app = createOrbit({
  canvas: document.querySelector('canvas'),
  near: 0.0001,
  far: 10000,
  antialias: true,
  position: [2, 3, -4],
  zoomSpeed: 0,
  pinch: false
})

// for OSX and such
process.nextTick(() => app.renderer.getContext().lineWidth(1.5))

let isDark = false
let isKeyDown = false
const infoElement = document.querySelector('.info')
const reverbTween = { wet: 0, dry: 1 }
const bg = createBackground()
app.scene.add(bg)
updateBackground(app, bg, 0)
createStars(250).forEach(m => app.scene.add(m))
createAsteroids(55).forEach(m => app.scene.add(m))

const planet = createPlanet()
app.scene.add(planet)

// store all original colors
const meshes = []
app.scene.traverse(mesh => {
  if (mesh.material &&
      mesh.material instanceof THREE.MeshBasicMaterial &&
      mesh.material.color) {
    const col = mesh.material.color
    if (col.equals(mainColor)) {
      mesh.material.colorA = mainColor
      mesh.material.colorB = altColor
    } else {
      mesh.material.colorA = altColor
      mesh.material.colorB = mainColor
    }
    mesh.colorTween = { value: 0 }
    meshes.push(mesh)
  }
})

meshes.sort((a, b) => {
  const aLen = a.localToWorld(a.position).length()
  const bLen = a.localToWorld(a.position).length()
  return bLen - aLen
})

let time = 0
app.on('tick', dt => {
  time += Math.min(30, dt) / 1000
  updateBackground(app, bg, meshes[0].colorTween.value)
  meshes.forEach(mesh => {
    const value = mesh.colorTween.value
    const material = mesh.material
    material.color.copy(material.colorA).lerp(material.colorB, value)
  })
})

setupAudio()
window.flipSwitch = flipSwitch
// flipSwitch()

function setupAudio () {
  const audio = audioPlayer('assets/soul.mp3', {
    loop: true,
  })
  const context = audio.context
  const analyser = audioAnalyser(audio.node, context, {
    stereo: false,
    audible: false
  })

  const reverb = createReverb(context)
  audio.node.connect(reverb)
  reverb.connect(context.destination)

  reverb.time = 2
  reverb.wet.value = reverbTween.wet
  reverb.dry.value = reverbTween.dry
  reverb.filterType = 'lowpass'
  reverb.cutoff.value = 6000
  audio.play()

  app.on('tick', () => {
    reverb.wet.value = reverbTween.wet
    reverb.dry.value = reverbTween.dry

    const analyserNode = analyser.analyser

    // grab our byte frequency data for this frame
    const freqs = analyser.frequencies()

    // find an average signal between two Hz ranges
    let avg = average(analyserNode, freqs, 40, 100)
    let s = 0.5 + avg * 0.5
    planet.children[2].scale.set(s, s, s)

    avg = average(analyserNode, freqs, 4400, 4500)
    s = 1 + avg * 0.5
    planet.children[3].scale.set(s, s, s)
  })
}

function flipSwitch () {
  const wet = isDark ? 0 : 1
  const dry = isDark ? 1 : 0
  const color = isDark ? 0 : 1
  const duration = 0.3
  isDark = !isDark
  
  classes.remove(infoElement, 'alt')
  if (isDark) classes.add(infoElement, 'alt')

  tweenr.to(reverbTween, {
    duration: duration, wet: wet, dry: dry,
    ease: 'expoOut'
  })
  meshes.forEach((mesh, i) => {
    tweenr.to(mesh.colorTween, {
      duration: duration, value: color,
      ease: 'expoOut'
    })
  })
}

window.addEventListener('keydown', (ev) => {
  if (ev.keyCode === 32) {
    ev.preventDefault()
    if (!isKeyDown) flipSwitch()
    isKeyDown = true
  }
})

window.addEventListener('keyup', (ev) => {
  if (ev.keyCode === 32) {
    ev.preventDefault()
    if (isKeyDown) flipSwitch()
    isKeyDown = false
  }
})