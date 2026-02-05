/*
 * @inovvia/japa-reporter-report-portal
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { type AxiosRequestConfig } from 'axios'
import { AgentOptions } from 'https'

import { Attribute } from './common.js'
import { LAUNCH_MODES } from '../constants/index.js'

export interface RestClientConfig extends AxiosRequestConfig {
  agent?: AgentOptions
}

interface ClientConfig {
  project: string
  endpoint: string
  launch: string
  apiKey?: string
  oauth?: {
    tokenEndpoint: string
    username: string
    password: string
    clientId: string
    clientSecret?: string
    scope?: string
  }

  debug?: boolean
  isLaunchMergeRequired?: boolean
  restClientConfig?: RestClientConfig
  headers?: Record<string, string>
}

export interface ReportPortalConfig extends ClientConfig {
  // common options
  launchId?: string
  attributes?: Array<Attribute>
  description?: string
  rerun?: boolean
  rerunOf?: string
  mode?: LAUNCH_MODES

  // agent specific options
  skippedIssue?: boolean
  extendTestDescriptionWithLastError?: boolean
}
