/*
 * @inovvia/japa-reporter-report-portal
 *
 * Type declarations for @reportportal/client-javascript
 */

declare module '@reportportal/client-javascript' {
  import type { AxiosRequestConfig } from 'axios'
  import type { AgentOptions } from 'https'

  export interface RestClientConfig extends AxiosRequestConfig {
    agent?: AgentOptions
  }

  export interface ClientConfig {
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
    skippedIsNotIssue?: boolean
  }

  export interface AgentInfo {
    name: string
    version: string
  }

  export interface StartLaunchResponse {
    tempId: string
    promise: Promise<void>
  }

  export interface StartTestItemResponse {
    tempId: string
    promise: Promise<void>
  }

  export interface FinishTestItemResponse {
    promise: Promise<void>
  }

  export interface SendLogResponse {
    promise: Promise<void>
  }

  export interface FinishLaunchResponse {
    promise: Promise<void>
  }

  export interface StartLaunchObjType {
    startTime?: string | number
    attributes?: Array<{ value: string; key?: string; system?: boolean }>
    description?: string
    name?: string
    rerun?: boolean
    rerunOf?: string
    mode?: string
    id?: string
  }

  export interface StartTestObjType {
    name: string
    type: string
    attributes?: Array<{ value: string; key?: string; system?: boolean }>
    description?: string
    startTime?: string | number
    codeRef?: string
    testCaseId?: string
    retry?: boolean
  }

  export interface FinishTestItemObjType {
    endTime?: string | number
    status?: string
    attributes?: Array<{ value: string; key?: string; system?: boolean }>
    description?: string
    testCaseId?: string
    issue?: { issueType: string }
  }

  export interface Attachment {
    name: string
    type: string
    content: string | Buffer
  }

  export interface LogRQ {
    level?: string
    message?: string
    time?: string | number
    file?: Attachment
  }

  export default class RPClient {
    constructor(config: ClientConfig, agentInfo: AgentInfo)
    startLaunch(obj: StartLaunchObjType): StartLaunchResponse
    startTestItem(obj: StartTestObjType, launchId: string, parentId?: string): StartTestItemResponse
    finishTestItem(testItemId: string, obj: FinishTestItemObjType): FinishTestItemResponse
    sendLog(testItemId: string, logRq: LogRQ, file?: Attachment): SendLogResponse
    finishLaunch(launchId: string, obj: { endTime?: string | number }): FinishLaunchResponse
  }
}

declare module '@reportportal/client-javascript/lib/helpers' {
  export default {
    now(): number
  }
}

declare module '@reportportal/client-javascript/lib/helpers.js' {
  export default {
    now(): number
  }
}
