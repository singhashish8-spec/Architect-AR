import type { DetailedHTMLProps, HTMLAttributes } from 'react'

// @google/model-viewer registers a custom element but doesn't ship JSX
// typings compatible with React's IntrinsicElements out of the box --
// declared here rather than reaching for `any`. Augmenting the 'react'
// module's JSX namespace, not `declare global { namespace JSX }` -- React
// 19's types resolve IntrinsicElements this way under the react-jsx
// transform, and the older global-namespace pattern doesn't merge here.
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string
        alt?: string
        ar?: boolean
        'ar-modes'?: string
        'ar-scale'?: 'auto' | 'fixed'
        'camera-controls'?: boolean
        scale?: string
      }
    }
  }
}
