import { Component, type ReactNode } from 'react'

/** Catches render/runtime errors in a subtree (e.g. WebGL context failure in the
 *  3D background) and renders a fallback instead of crashing the whole app. */
export default class ErrorBoundary extends Component<{ fallback?: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(err: unknown) { console.warn('[ErrorBoundary] subtree failed, using fallback:', err) }
  render() {
    if (this.state.failed) return this.props.fallback ?? null
    return this.props.children
  }
}
