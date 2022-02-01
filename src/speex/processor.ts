import {
  SpeexPreprocessor,
  type SpeexModule
} from '@sapphi-red/speex-preprocess-wasm'
import { type Process } from '../utils/process'

export const createProcessor = (
  module: SpeexModule,
  {
    bufferSize,
    channels,
    sampleRate
  }: { bufferSize: number; channels: number; sampleRate: number }
) => {
  const preprocessors = Array.from(
    { length: channels },
    () => new SpeexPreprocessor(module, bufferSize, sampleRate)
  )
  for (const preprocessor of preprocessors) {
    preprocessor.denoise = true
  }

  const process: Process = (input, output) => {
    for (let i = 0; i < channels; i++) {
      preprocessors[i]!.process(input[i]!)
      output[i]!.set(input[i]!)
    }
  }

  return { process, preprocessors }
}
