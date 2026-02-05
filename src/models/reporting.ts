/*
 * @inovvia/japa-reporter-report-portal
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Attribute, Issue } from './common.js'
import { TEST_ITEM_TYPES, LOG_LEVELS, LAUNCH_MODES } from '../constants/index.js'

export interface StartLaunchObjType {
  startTime?: string | number
  attributes?: Array<Attribute>
  description?: string
  name?: string
  rerun?: boolean
  rerunOf?: string
  mode?: LAUNCH_MODES
  id?: string
}

export interface StartTestObjType {
  name: string
  type: TEST_ITEM_TYPES
  attributes?: Array<Attribute>
  description?: string
  startTime?: string | number
  codeRef?: string
  testCaseId?: string
  retry?: boolean
}

export interface FinishTestItemObjType {
  endTime?: string | number
  status?: string
  attributes?: Attribute[]
  description?: string
  testCaseId?: string
  issue?: Issue
}

export interface Attachment {
  name: string
  type: string
  content: string | Buffer
}

export interface LogRQ {
  level?: LOG_LEVELS
  message?: string
  time?: string | number
  file?: Attachment
}
