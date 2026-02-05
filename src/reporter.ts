/*
 * @inovvia/japa-reporter-report-portal
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import RPClient from '@reportportal/client-javascript'
import clientHelpers from '@reportportal/client-javascript/lib/helpers.js'
import { BaseReporter } from '@japa/runner/core'
import type {
  TestEndNode,
  SuiteEndNode,
  GroupEndNode,
  TestStartNode,
  RunnerEndNode,
  GroupStartNode,
  SuiteStartNode,
  RunnerStartNode,
} from '@japa/core/types'
import { ReportPortalConfig, Attribute } from './models/index.js'
import {
  getAgentInfo,
  promiseErrorHandler,
  getCodeRef,
  getBasePath,
  isErrorLog,
  getSystemAttribute,
} from './utils.js'
import {
  LAUNCH_MODES,
  PREDEFINED_LOG_LEVELS,
  STATUSES,
  TEST_ITEM_TYPES,
} from './constants/index.js'
import type { FinishTestItemObjType, LogRQ } from './models/index.js'

interface TestItem {
  id: string
  finishSend?: boolean
  status?: STATUSES
  startTime?: number
}

/**
 * Report Portal reporter for Japa test framework
 */
export class RPReporter extends BaseReporter {
  private config: ReportPortalConfig
  private client: RPClient
  private launchId: string | null = null
  private promises: Promise<void>[] = []
  private testItems: Map<string, TestItem> = new Map()
  private rootDir: string = process.cwd()
  private suiteStack: string[] = []
  private groupStack: string[] = []

  constructor(config: ReportPortalConfig) {
    super()
    this.config = {
      extendTestDescriptionWithLastError: true,
      ...config,
      launchId: process.env.RP_LAUNCH_ID || config.launchId,
    }

    const agentInfo = getAgentInfo()

    this.client = new RPClient(
      {
        ...this.config,
        skippedIsNotIssue: String(this.config.skippedIssue).toLowerCase() === 'false',
      },
      agentInfo,
    )
  }

  /**
   * Add request to promises queue for error handling
   */
  private addRequestToPromisesQueue(promise: Promise<void>, failMessage: string): void {
    this.promises.push(promiseErrorHandler(promise, failMessage))
  }

  /**
   * Extract title string from title (can be string or object with expanded property)
   */
  private getTitleString(title: string | { original: string; expanded: string }): string {
    return typeof title === 'string' ? title : title.expanded
  }

  /**
   * Get unique identifier for test item
   */
  private getTestItemId(type: 'suite' | 'group' | 'test', name: string): string {
    const parts: string[] = []
    if (this.currentSuiteName) parts.push(this.currentSuiteName)
    if (type === 'group' && this.currentGroupName) parts.push(this.currentGroupName)
    parts.push(type, name)
    if (this.currentFileName) parts.push(this.currentFileName)
    return parts.join('::')
  }

  /**
   * Get parent test item ID from stack
   * Returns undefined if there's no parent group/suite (items will be direct children of launch)
   */
  private getParentId(): string | undefined {
    if (this.groupStack.length > 0) {
      return this.testItems.get(this.groupStack[this.groupStack.length - 1])?.id
    }
    if (this.suiteStack.length > 0) {
      return this.testItems.get(this.suiteStack[this.suiteStack.length - 1])?.id
    }
    // Return undefined, NOT launchId - parentId should only be set for nested items
    return undefined
  }

  /**
   * Map Japa test status to Report Portal status
   */
  private getStatus(payload: TestEndNode | GroupEndNode | SuiteEndNode): STATUSES {
    if ('hasError' in payload && payload.hasError) {
      return STATUSES.FAILED
    }
    if ('isSkipped' in payload && payload.isSkipped) {
      return STATUSES.SKIPPED
    }
    if ('isTodo' in payload && payload.isTodo) {
      return STATUSES.SKIPPED
    }
    return STATUSES.PASSED
  }

  /**
   * Send log to Report Portal
   */
  private sendLog(testItemId: string, logRq: LogRQ): void {
    const { file, ...logRqWithoutFile } = logRq
    const { promise } = this.client.sendLog(
      testItemId,
      {
        level: PREDEFINED_LOG_LEVELS.INFO,
        time: clientHelpers.now(),
        ...logRqWithoutFile,
      },
      file,
    )
    this.addRequestToPromisesQueue(promise, 'Failed to send log.')
  }

  /**
   * Get finish test item object
   */
  private getFinishTestItemObj(
    payload: TestEndNode | GroupEndNode | SuiteEndNode,
    testItemId?: string,
  ): FinishTestItemObjType {
    const finishTestItemObj: FinishTestItemObjType = {
      status: this.getStatus(payload),
      endTime: clientHelpers.now(),
    }

    if ('duration' in payload && Number.isFinite(payload.duration) && testItemId) {
      const testItem = this.testItems.get(testItemId)
      if (testItem?.startTime && Number.isFinite(testItem.startTime)) {
        finishTestItemObj.endTime = testItem.startTime + Math.round(payload.duration)
      }
    }

    if ('isTodo' in payload && payload.isTodo) {
      finishTestItemObj.attributes = [{ value: 'todo' }]
    }

    return finishTestItemObj
  }

  /**
   * Start launch in Report Portal
   */
  protected async start(_: RunnerStartNode): Promise<void> {
    if (this.runner) {
      // Try to get root directory from runner if available
      this.rootDir = process.cwd()
    }

    const { launch, description, attributes, rerun, rerunOf, mode, launchId } = this.config
    const systemAttribute: Attribute = getSystemAttribute()

    const startLaunchObj = {
      name: launch,
      startTime: clientHelpers.now(),
      description,
      attributes:
        attributes && attributes.length ? attributes.concat(systemAttribute) : [systemAttribute],
      rerun,
      rerunOf,
      mode: mode || LAUNCH_MODES.DEFAULT,
      id: launchId,
    }

    if (this.config.debug) {
      console.log('[RP] Starting launch:', startLaunchObj.name)
    }

    const { tempId, promise } = this.client.startLaunch(startLaunchObj)
    this.addRequestToPromisesQueue(promise, 'Failed to start launch.')
    this.launchId = tempId

    if (this.config.debug) {
      console.log('[RP] Launch tempId:', tempId)
    }
  }

  /**
   * Start suite in Report Portal
   */
  protected onSuiteStart(payload: SuiteStartNode): void {
    const suiteId = this.getTestItemId('suite', payload.name)
    const parentId = this.getParentId()
    const basePath = this.currentFileName
      ? getBasePath(this.currentFileName, this.rootDir)
      : ''
    const codeRef = getCodeRef(basePath, payload.name)

    const startTestItemObj = {
      name: payload.name,
      startTime: clientHelpers.now(),
      type: TEST_ITEM_TYPES.SUITE,
      codeRef,
    }

    const testItemObj = this.client.startTestItem(startTestItemObj, this.launchId!, parentId)
    this.addRequestToPromisesQueue(testItemObj.promise, 'Failed to start test item.')

    this.testItems.set(suiteId, {
      id: testItemObj.tempId,
      startTime: clientHelpers.now(),
    })
    this.suiteStack.push(suiteId)
  }

  /**
   * End suite in Report Portal
   */
  protected onSuiteEnd(payload: SuiteEndNode): void {
    const suiteId = this.suiteStack.pop()
    if (!suiteId) return

    const testItem = this.testItems.get(suiteId)
    if (!testItem?.id) return

    const finishTestItemObj = this.getFinishTestItemObj(payload, suiteId)

    if (payload.errors?.length) {
      payload.errors.forEach(({ error }: { error: Error }) => {
        const logRq: LogRQ = {
          time: finishTestItemObj.endTime,
          level: PREDEFINED_LOG_LEVELS.ERROR,
          message: error.stack || error.message,
        }
        this.sendLog(testItem.id, logRq)
      })
    }

    const { promise } = this.client.finishTestItem(testItem.id, finishTestItemObj)
    this.addRequestToPromisesQueue(promise, 'Failed to finish test item.')

    this.testItems.set(suiteId, {
      ...testItem,
      finishSend: true,
    })
  }

  /**
   * Start group in Report Portal
   */
  protected onGroupStart(payload: GroupStartNode): void {
    const groupId = this.getTestItemId('group', payload.title)
    const parentId = this.getParentId()
    const basePath = this.currentFileName
      ? getBasePath(this.currentFileName, this.rootDir)
      : ''
    const codeRef = getCodeRef(basePath, payload.title)

    const startTestItemObj = {
      name: payload.title,
      startTime: clientHelpers.now(),
      type: TEST_ITEM_TYPES.SUITE,
      codeRef,
    }

    if (this.config.debug) {
      console.log(`[RP] Starting group: "${payload.title}" (parentId: ${parentId || 'none'})`)
    }

    const testItemObj = this.client.startTestItem(startTestItemObj, this.launchId!, parentId)
    this.addRequestToPromisesQueue(testItemObj.promise, `Failed to start group: ${payload.title}`)

    this.testItems.set(groupId, {
      id: testItemObj.tempId,
      startTime: clientHelpers.now(),
    })
    this.groupStack.push(groupId)
  }

  /**
   * End group in Report Portal
   */
  protected onGroupEnd(payload: GroupEndNode): void {
    const groupId = this.groupStack.pop()
    if (!groupId) return

    const testItem = this.testItems.get(groupId)
    if (!testItem?.id) return

    const finishTestItemObj = this.getFinishTestItemObj(payload, groupId)

    if (payload.errors?.length) {
      payload.errors.forEach(({ error }: { error: Error }) => {
        const logRq: LogRQ = {
          time: finishTestItemObj.endTime,
          level: PREDEFINED_LOG_LEVELS.ERROR,
          message: error.stack || error.message,
        }
        this.sendLog(testItem.id, logRq)
      })
    }

    const { promise } = this.client.finishTestItem(testItem.id, finishTestItemObj)
    this.addRequestToPromisesQueue(promise, 'Failed to finish test item.')

    this.testItems.set(groupId, {
      ...testItem,
      finishSend: true,
    })
  }

  /**
   * Start test in Report Portal
   */
  protected onTestStart(payload: TestStartNode): void {
    const titleStr = this.getTitleString(payload.title)
    const testId = this.getTestItemId('test', titleStr)
    const parentId = this.getParentId()
    const basePath = this.currentFileName
      ? getBasePath(this.currentFileName, this.rootDir)
      : ''
    const codeRef = getCodeRef(basePath, titleStr)

    const startTestItemObj = {
      name: titleStr,
      startTime: clientHelpers.now(),
      type: TEST_ITEM_TYPES.STEP,
      codeRef,
    }

    if (this.config.debug) {
      console.log(`[RP] Starting test: "${titleStr}" (parentId: ${parentId || 'none'})`)
    }

    const testItemObj = this.client.startTestItem(startTestItemObj, this.launchId!, parentId)
    this.addRequestToPromisesQueue(testItemObj.promise, `Failed to start test: ${titleStr}`)

    this.testItems.set(testId, {
      id: testItemObj.tempId,
      startTime: clientHelpers.now(),
    })
  }

  /**
   * End test in Report Portal
   */
  protected onTestEnd(payload: TestEndNode): void {
    const titleStr = this.getTitleString(payload.title)
    const testId = this.getTestItemId('test', titleStr)
    const testItem = this.testItems.get(testId)
    if (!testItem?.id || testItem.finishSend) {
      if (this.config.debug) {
        console.log(`[RP] Skipping test end (already finished or not found): "${titleStr}"`)
      }
      return
    }

    const finishTestItemObj = this.getFinishTestItemObj(payload, testId)

    if (this.config.debug) {
      console.log(`[RP] Finishing test: "${titleStr}" (status: ${finishTestItemObj.status})`)
    }

    // Handle skipped/todo tests
    if (payload.isSkipped || payload.isTodo) {
      const { promise } = this.client.finishTestItem(testItem.id, finishTestItemObj)
      this.addRequestToPromisesQueue(promise, `Failed to finish test: ${titleStr}`)
      this.testItems.set(testId, {
        ...testItem,
        finishSend: true,
      })
      return
    }

    // Handle errors
    if (payload.hasError && payload.errors?.length) {
      if (this.config.debug) {
        console.log(`[RP] Sending ${payload.errors.length} error log(s) for: "${titleStr}"`)
      }
      payload.errors.forEach(({ error }: { error: Error }) => {
        if (this.config.extendTestDescriptionWithLastError) {
          finishTestItemObj.description = (finishTestItemObj.description || '').concat(
            `\n\`\`\`error\n${error.message}\n\`\`\``,
          )
        }

        const logRq: LogRQ = {
          time: finishTestItemObj.endTime,
          level: PREDEFINED_LOG_LEVELS.ERROR,
          message: error.stack || error.message,
        }
        this.sendLog(testItem.id, logRq)
      })
    }

    const { promise } = this.client.finishTestItem(testItem.id, finishTestItemObj)
    this.addRequestToPromisesQueue(promise, `Failed to finish test: ${titleStr}`)

    this.testItems.set(testId, {
      ...testItem,
      finishSend: true,
    })
  }

  /**
   * Finish launch in Report Portal
   */
  protected async end(_: RunnerEndNode): Promise<void> {
    if (!this.config.launchId && this.launchId) {
      const { promise } = this.client.finishLaunch(this.launchId, {
        endTime: clientHelpers.now(),
      })
      this.addRequestToPromisesQueue(promise, 'Failed to finish launch.')
    }

    // Wait for all promises to complete
    try {
      await Promise.all(this.promises)
      
      // Log summary of what was sent
      const totalItems = this.testItems.size
      const finishedItems = Array.from(this.testItems.values()).filter(item => item.finishSend).length
      console.log(`\n✓ Report Portal: Sent ${finishedItems}/${totalItems} test items`)
      
      // Note: Launch link is printed automatically by the RP client library
    } catch (error) {
      console.error('Error finishing Report Portal requests:', error)
    }

    this.launchId = null
    this.testItems.clear()
    this.suiteStack = []
    this.groupStack = []
  }
}
