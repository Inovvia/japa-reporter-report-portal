/*
 * @inovvia/japa-reporter-report-portal
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { normalize, sep } from 'node:path'
import { Attribute } from './models/index.js'

export const getAgentInfo = (): { version: string; name: string } => ({
  version: '1.0.0',
  name: '@inovvia/japa-reporter-report-portal',
})

export const getSystemAttribute = (): Attribute => {
  const agentInfo = getAgentInfo()
  return {
    key: 'agent',
    value: `${agentInfo.name}|${agentInfo.version}`,
    system: true,
  }
}

export const promiseErrorHandler = (promise: Promise<void>, message = ''): Promise<void> =>
  promise.catch((err) => {
    // Log errors but don't fail the test run
    // Connection errors are expected if RP server is unreachable
    const errorMsg = err.message || String(err)
    if (errorMsg.includes('ECONNREFUSED')) {
      // Check if it's trying to use HTTPS when endpoint is HTTP
      if (errorMsg.includes(':443')) {
        console.warn(`⚠️  ${message}: Connection refused on port 443 (HTTPS).`)
        console.warn(`   Your endpoint uses HTTP but some requests are trying HTTPS.`)
        console.warn(`   This may cause some test items to not appear in Report Portal.`)
      } else {
        console.warn(`⚠️  ${message}: Cannot connect to Report Portal server.`)
        console.warn(`   Check your endpoint URL (${process.env.RP_ENDPOINT || 'not set'}) and network connectivity.`)
      }
    } else if (!errorMsg.includes('ECONNREFUSED')) {
      // Only log non-connection errors to avoid spam
      console.error(`❌ ${message}:`, errorMsg)
    }
  })

export const getBasePath = (filePath: string, rootDir: string): string =>
  filePath.replace(rootDir, '').replace(new RegExp('\\'.concat(sep), 'g'), '/')

export const getCodeRef = (basePath: string, itemTitle: string): string =>
  normalize([basePath, itemTitle].join('/'))

export const isErrorLog = (message: string): boolean => {
  return message.toLowerCase().includes('error')
}
