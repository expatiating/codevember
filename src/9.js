const svgAssets = require('../assets/entypo-svg-paths.json')
const shuffle = require('array-shuffle')
const randomSphere = require('gl-vec2/random')
const random = require('random-float')
const parseSvg = require('parse-svg-path')
const simplifyPath = require('simplify-path')
const normalize = require('normalize-path-scale')
const boundPoints = require('bound-points')
const getContours = require('svg-path-contours')
const SimplexNoise = require('simplex-noise')
const once = require('once')

const canvas = document.createElement('canvas')
const simplex = new SimplexNoise()

const ctx = canvas.getContext('2d')
const shape = [ window.innerWidth, window.innerHeight ]
const scale = window.devicePixelRatio
const strokes = 4

let svgPaths
let positions
let current = 0
const meshes = []
let timer
const [width, height] = shape
const radius = Math.min(width, height) * 0.35

canvas.style.width = width + 'px'
canvas.style.height = height + 'px'
canvas.width = (width * scale)
canvas.height = (height * scale)

ctx.scale(scale, scale)
document.body.appendChild(canvas)
start()

function start () {
  ctx.clearRect(0, 0, width, height)
  svgPaths = shuffle(svgAssets.map(x => x.path))
  positions = svgPaths.map(() => randomSphere([], Math.random()))
  current = 0
  meshes.length = 0

  load(() => {
    let running = true
    timer = setInterval(() => {
      if (!running) return
      if (current > meshes.length - 1) {
        clearInterval(timer)
        return
      }
      render()
    }, 1000 / 60)
    
    const next = once(() => {
      running = false
      clearInterval(timer)
      start()
    })
    window.addEventListener('click', next, false)
    window.addEventListener('touchstart', next)
  })
}

function load (cb) {
  process.nextTick(next)

  function next () {
    if (svgPaths.length === 0) return cb()
    const path = svgPaths.pop()
    const simplify = Math.random() > 0.5
    let contours = getContours(parseSvg(path), 20).map(x => {
      return simplify ? simplifyPath(x, 1) : x
    })

    const allPos = contours.reduce(function (a, b) {
      return a.concat(b)
    }, [])
    const bounds = boundPoints(allPos)
    contours = contours.map(x => {
      return normalize(x, bounds)
    })

    const mesh = {
      contours,
      opacity: random(0.6, 1.0),
      size: random(0.05, 0.2),
      outline: random(0.15, 2.5),
      rotation: random(-Math.PI * 2, Math.PI * 2)
    }
    meshes.push(mesh)
    process.nextTick(next)
  }
}

function render () {
  ctx.save()
  ctx.translate(width / 2, height / 2)
  ctx.scale(radius, radius)
  const count = 4
  const length = Math.min(current + count, meshes.length)
  for (let i = current; i < length; i++) {
    const pos = positions[i]
    const mesh = meshes[i]
    if (!mesh) return
    const { size, outline } = mesh
    ctx.lineCap = ctx.lineJoin = 'round'
    ctx.fillStyle = 'white'
    ctx.save()
    ctx.translate(pos[0], pos[1])
    ctx.scale(size, size)

    ctx.globalAlpha = 1
    renderMesh(ctx, mesh, 0, true, 0)
    for (let j = 0; j < strokes; j++) {
      ctx.globalAlpha = 1 / strokes
      ctx.lineWidth = (1 / size * 1 / radius) * outline
      renderMesh(ctx, mesh, 0.035, false, j, j / (strokes - 1))
    }
    ctx.restore()
  }
  current += count
  ctx.restore()
}

function renderMesh (ctx, mesh, offset, fill, time, shake) {
  const { contours, rotation } = mesh
  ctx.beginPath()
  ctx.rotate(rotation)
  contours.forEach(contour => {
    for (let i = 0; i < contour.length; i++) {
      const [x, y] = contour[i]
      const zoom = shake * 3
      let xoff = 0
      let yoff = 0
      if (offset > 0) {
        xoff = offset * simplex.noise3D(x * zoom, y * zoom, time)
        yoff = offset * simplex.noise3D(x * zoom, y * zoom, time)
      }

      if (i === 0) ctx.moveTo(x + xoff, y + yoff)
      else ctx.lineTo(x + xoff, y + yoff)
    }
  })
  ctx.rotate(-rotation)
  if (fill) ctx.fill()
  else ctx.stroke()
}