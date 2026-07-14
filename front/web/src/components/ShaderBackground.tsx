import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { ShaderGradient } from '@shadergradient/react'
import type { ProductId } from '../types'
import { preloadShaderEnv } from '../lib/preloadShaderEnv'

// One ShaderGradient config per product (ported from the original module script).
const SHADERS: Record<ProductId, Record<string, unknown>> = {
  ppt: {
    control: 'props', animate: 'on', brightness: 0.8,
    cAzimuthAngle: 270, cDistance: 0.5, cPolarAngle: 180, cameraZoom: 15.1,
    color1: '#73bfc4', color2: '#ff810a', color3: '#8da0ce',
    bgColor1: '#000000', bgColor2: '#000000',
    grain: 'on', lightType: 'env', envPreset: 'city', reflection: 0.4,
    positionX: -0.1, positionY: 0, positionZ: 0,
    rotationX: 0, rotationY: 130, rotationZ: 70,
    type: 'sphere', uAmplitude: 3.2, uDensity: 0.8, uFrequency: 5.5, uSpeed: 0.3, uStrength: 0.3, uTime: 0, fov: 45,
  },
  kurs: {
    control: 'props', animate: 'on', brightness: 0.25,
    cAzimuthAngle: 170, cDistance: 4.4, cPolarAngle: 70, cameraZoom: 1,
    color1: '#00ff00', color2: '#ffdc17', color3: '#ffd621',
    bgColor1: '#000000', bgColor2: '#000000',
    grain: 'on', lightType: '3d', reflection: 0.1,
    positionX: 0, positionY: 0.9, positionZ: -0.3,
    rotationX: 45, rotationY: 0, rotationZ: 0,
    type: 'waterPlane', uAmplitude: 0, uDensity: 1.2, uFrequency: 0, uSpeed: 0.2, uStrength: 3.4, uTime: 0, fov: 45,
  },
  mustaqil: {
    control: 'props', animate: 'on', brightness: 0.405,
    cAzimuthAngle: 180, cDistance: 2.8, cPolarAngle: 80, cameraZoom: 9.1,
    color1: '#606080', color2: '#8d7dca', color3: '#212121',
    bgColor1: '#000000', bgColor2: '#000000',
    grain: 'on', lightType: '3d', reflection: 0.1,
    positionX: 0, positionY: 0, positionZ: 0,
    rotationX: 50, rotationY: 0, rotationZ: -60,
    type: 'waterPlane', uAmplitude: 0, uDensity: 1.5, uFrequency: 0, uSpeed: 0.3, uStrength: 1.5, uTime: 8, fov: 45,
  },
}

// Which shader effect each product shows. PPT and Self-study are swapped.
const EFFECT: Record<ProductId, ProductId> = { ppt: 'mustaqil', kurs: 'kurs', mustaqil: 'ppt' }

export default function ShaderBackground({ product }: { product: ProductId }) {
  const p = SHADERS[EFFECT[product]] || SHADERS.ppt
  useEffect(() => {
    // Warm the third page's HDR env maps in the background so it doesn't stall
    // when first opened (it keeps the env/city look; only the load is hidden).
    preloadShaderEnv()
    // Nudge the canvas to size correctly right after first mount (it can come up
    // 0-height until a resize event fires).
    const kick = () => window.dispatchEvent(new Event('resize'))
    const r1 = requestAnimationFrame(() => requestAnimationFrame(kick))
    const t1 = window.setTimeout(kick, 250)
    const t2 = window.setTimeout(kick, 800)
    return () => { cancelAnimationFrame(r1); clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div id="shaderBg-root" aria-hidden="true">
      <Canvas
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}
        camera={{ position: [0, 0, p.cDistance as number], fov: (p.fov as number) || 45, zoom: p.cameraZoom as number }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      >
        {/* key forces a clean remount when the geometry type changes (sphere <-> waterPlane) */}
        <ShaderGradient key={product} {...(p as Record<string, never>)} />
      </Canvas>
    </div>
  )
}
