/*
 * @inovvia/japa-reporter-report-portal
 *
 * End-to-end tests for the Report Portal reporter
 */

/// <reference types="node" />
import { test, describe } from 'node:test'
import assert from 'node:assert'
import { RPReporter } from '../src/reporter.js'
import type { ReportPortalConfig } from '../src/models/index.js'
import { STATUSES, TEST_ITEM_TYPES, PREDEFINED_LOG_LEVELS } from '../src/constants/index.js'
import type {
  TestStartNode,
  TestEndNode,
  GroupStartNode,
  GroupEndNode,
  SuiteStartNode,
  SuiteEndNode,
  RunnerStartNode,
  RunnerEndNode,
} from '@japa/core/types'

// ============================================================================
// Mock RPClient
// ============================================================================

interface MockCall {
  method: string
  args: any[]
  timestamp: number
}

class MockRPClient {
  calls: MockCall[] = []
  launchTempId = 'mock-launch-123'
  testItemCounter = 0

  private recordCall(method: string, ...args: any[]) {
    this.calls.push({ method, args, timestamp: Date.now() })
  }

  startLaunch(obj: any) {
    this.recordCall('startLaunch', obj)
    return {
      tempId: this.launchTempId,
      promise: Promise.resolve({ id: this.launchTempId }),
    }
  }

  finishLaunch(launchId: string, obj: any) {
    this.recordCall('finishLaunch', launchId, obj)
    return {
      promise: Promise.resolve(),
    }
  }

  startTestItem(obj: any, launchId: string, parentId?: string) {
    this.recordCall('startTestItem', obj, launchId, parentId)
    const tempId = `mock-test-item-${++this.testItemCounter}`
    return {
      tempId,
      promise: Promise.resolve({ id: tempId }),
    }
  }

  finishTestItem(testItemId: string, obj: any) {
    this.recordCall('finishTestItem', testItemId, obj)
    return {
      promise: Promise.resolve(),
    }
  }

  sendLog(testItemId: string, logRq: any, file?: any) {
    this.recordCall('sendLog', testItemId, logRq, file)
    return {
      promise: Promise.resolve(),
    }
  }

  getCallsByMethod(method: string): MockCall[] {
    return this.calls.filter((c) => c.method === method)
  }

  getLastCall(method: string): MockCall | undefined {
    const calls = this.getCallsByMethod(method)
    return calls[calls.length - 1]
  }

  reset() {
    this.calls = []
    this.testItemCounter = 0
  }
}

// ============================================================================
// Mock Emitter and Runner
// ============================================================================

class MockEmitter {
  listeners: Map<string, Function[]> = new Map()

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
    return this
  }

  emit(event: string, ...args: any[]) {
    const callbacks = this.listeners.get(event) || []
    callbacks.forEach((cb) => cb(...args))
  }
}

class MockRunner {
  getSummary() {
    return {
      aggregates: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        todo: 0,
        regression: 0,
      },
      duration: 0,
      hasError: false,
      failureTree: [],
      failedTestsTitles: [],
    }
  }
}

// ============================================================================
// Test Helpers
// ============================================================================

function createReporter(config?: Partial<ReportPortalConfig>): {
  reporter: RPReporter
  mockClient: MockRPClient
  mockEmitter: MockEmitter
  mockRunner: MockRunner
} {
  const fullConfig: ReportPortalConfig = {
    endpoint: 'https://example.com/api/v2',
    project: 'test-project',
    launch: 'test-launch',
    apiKey: 'test-api-key',
    ...config,
  }

  const reporter = new RPReporter(fullConfig)
  const mockClient = new MockRPClient()
  const mockEmitter = new MockEmitter()
  const mockRunner = new MockRunner()

  // Replace the real client with mock
  ;(reporter as any).client = mockClient

  // Boot the reporter
  reporter.boot(mockRunner as any, mockEmitter as any)

  return { reporter, mockClient, mockEmitter, mockRunner }
}

function createTestStartNode(title: string, overrides?: Partial<TestStartNode>): TestStartNode {
  return {
    title: { original: title, expanded: title },
    tags: [],
    timeout: 2000,
    meta: {},
    isPinned: false,
    ...overrides,
  }
}

function createTestEndNode(
  title: string,
  status: 'passed' | 'failed' | 'skipped' | 'todo',
  overrides?: Partial<TestEndNode>,
): TestEndNode {
  const base: TestEndNode = {
    title: { original: title, expanded: title },
    tags: [],
    timeout: 2000,
    meta: {},
    isPinned: false,
    duration: 100,
    hasError: false,
    errors: [],
    ...overrides,
  }

  switch (status) {
    case 'failed':
      base.hasError = true
      base.errors = [
        {
          phase: 'test',
          error: new Error('Test failed'),
        },
      ]
      break
    case 'skipped':
      base.isSkipped = true
      base.skipReason = 'Skipped for testing'
      break
    case 'todo':
      base.isTodo = true
      break
  }

  return base
}

function createGroupStartNode(title: string): GroupStartNode {
  return {
    title,
    meta: {},
  }
}

function createGroupEndNode(title: string, hasError = false): GroupEndNode {
  return {
    title,
    meta: {},
    hasError,
    errors: [],
  }
}

function createSuiteStartNode(name: string): SuiteStartNode {
  return { name }
}

function createSuiteEndNode(name: string, hasError = false): SuiteEndNode {
  return {
    name,
    hasError,
    errors: [],
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('RPReporter', () => {
  describe('Initialization', () => {
    test('initializes with config', () => {
      const config: ReportPortalConfig = {
        endpoint: 'https://example.com/api/v2',
        project: 'test-project',
        launch: 'test-launch',
        apiKey: 'test-api-key',
      }

      const reporter = new RPReporter(config)
      assert.ok(reporter instanceof RPReporter)
    })

    test('extends BaseReporter with boot method', () => {
      const config: ReportPortalConfig = {
        endpoint: 'https://example.com/api/v2',
        project: 'test-project',
        launch: 'test-launch',
        apiKey: 'test-api-key',
      }

      const reporter = new RPReporter(config)
      assert.ok(typeof reporter.boot === 'function')
    })

    test('uses RP_LAUNCH_ID from environment if set', () => {
      const originalEnv = process.env.RP_LAUNCH_ID
      process.env.RP_LAUNCH_ID = 'env-launch-id'

      try {
        const config: ReportPortalConfig = {
          endpoint: 'https://example.com/api/v2',
          project: 'test-project',
          launch: 'test-launch',
          apiKey: 'test-api-key',
        }

        const reporter = new RPReporter(config)
        assert.strictEqual((reporter as any).config.launchId, 'env-launch-id')
      } finally {
        if (originalEnv === undefined) {
          delete process.env.RP_LAUNCH_ID
        } else {
          process.env.RP_LAUNCH_ID = originalEnv
        }
      }
    })
  })

  describe('Launch Lifecycle', () => {
    test('starts launch on runner:start', async () => {
      const { mockClient, mockEmitter } = createReporter({ launch: 'My Test Launch' })

      // Trigger runner:start
      mockEmitter.emit('runner:start', {})

      // Wait for async operations
      await new Promise((r) => setTimeout(r, 10))

      const startLaunchCall = mockClient.getLastCall('startLaunch')
      assert.ok(startLaunchCall, 'startLaunch should be called')
      assert.strictEqual(startLaunchCall!.args[0].name, 'My Test Launch')
      assert.ok(startLaunchCall!.args[0].startTime, 'startTime should be set')
    })

    test('finishes launch on runner:end', async () => {
      const { mockClient, mockEmitter } = createReporter()

      // Start then end
      mockEmitter.emit('runner:start', {})
      await new Promise((r) => setTimeout(r, 10))

      mockEmitter.emit('runner:end', { hasError: false })
      await new Promise((r) => setTimeout(r, 10))

      const finishLaunchCall = mockClient.getLastCall('finishLaunch')
      assert.ok(finishLaunchCall, 'finishLaunch should be called')
      assert.ok(finishLaunchCall!.args[1].endTime, 'endTime should be set')
    })

    test('does not finish launch if launchId is provided in config', async () => {
      const { mockClient, mockEmitter } = createReporter({ launchId: 'existing-launch' })

      mockEmitter.emit('runner:start', {})
      await new Promise((r) => setTimeout(r, 10))

      mockEmitter.emit('runner:end', { hasError: false })
      await new Promise((r) => setTimeout(r, 10))

      const finishLaunchCalls = mockClient.getCallsByMethod('finishLaunch')
      assert.strictEqual(finishLaunchCalls.length, 0, 'finishLaunch should not be called')
    })
  })

  describe('Test Items', () => {
    test('starts and finishes test item for passing test', async () => {
      const { mockClient, mockEmitter } = createReporter()

      mockEmitter.emit('runner:start', {})
      await new Promise((r) => setTimeout(r, 10))

      // Start test
      mockEmitter.emit('test:start', createTestStartNode('should pass'))

      const startCalls = mockClient.getCallsByMethod('startTestItem')
      assert.strictEqual(startCalls.length, 1)
      assert.strictEqual(startCalls[0].args[0].name, 'should pass')
      assert.strictEqual(startCalls[0].args[0].type, TEST_ITEM_TYPES.STEP)

      // End test
      mockEmitter.emit('test:end', createTestEndNode('should pass', 'passed'))

      const finishCalls = mockClient.getCallsByMethod('finishTestItem')
      assert.strictEqual(finishCalls.length, 1)
      assert.strictEqual(finishCalls[0].args[1].status, STATUSES.PASSED)
    })

    test('reports FAILED status for failing test', async () => {
      const { mockClient, mockEmitter } = createReporter()

      mockEmitter.emit('runner:start', {})
      await new Promise((r) => setTimeout(r, 10))

      mockEmitter.emit('test:start', createTestStartNode('should fail'))
      mockEmitter.emit('test:end', createTestEndNode('should fail', 'failed'))

      const finishCall = mockClient.getLastCall('finishTestItem')
      assert.strictEqual(finishCall?.args[1].status, STATUSES.FAILED)
    })

    test('reports SKIPPED status for skipped test', async () => {
      const { mockClient, mockEmitter } = createReporter()

      mockEmitter.emit('runner:start', {})
      await new Promise((r) => setTimeout(r, 10))

      mockEmitter.emit('test:start', createTestStartNode('should skip'))
      mockEmitter.emit('test:end', createTestEndNode('should skip', 'skipped'))

      const finishCall = mockClient.getLastCall('finishTestItem')
      assert.strictEqual(finishCall?.args[1].status, STATUSES.SKIPPED)
    })

    test('reports SKIPPED status with todo attribute for todo test', async () => {
      const { mockClient, mockEmitter } = createReporter()

      mockEmitter.emit('runner:start', {})
      await new Promise((r) => setTimeout(r, 10))

      mockEmitter.emit('test:start', createTestStartNode('todo test'))
      mockEmitter.emit('test:end', createTestEndNode('todo test', 'todo'))

      const finishCall = mockClient.getLastCall('finishTestItem')
      assert.strictEqual(finishCall?.args[1].status, STATUSES.SKIPPED)
      assert.ok(
        finishCall?.args[1].attributes?.some((a: any) => a.value === 'todo'),
        'Should have todo attribute',
      )
    })

    test('sends error logs for failing tests', async () => {
      const { mockClient, mockEmitter } = createReporter()

      mockEmitter.emit('runner:start', {})
      await new Promise((r) => setTimeout(r, 10))

      mockEmitter.emit('test:start', createTestStartNode('should fail with error'))

      const testEndNode = createTestEndNode('should fail with error', 'failed')
      testEndNode.errors = [
        {
          phase: 'test',
          error: Object.assign(new Error('Something went wrong'), {
            stack: 'Error: Something went wrong\n    at Test.fn (test.js:10:5)',
          }),
        },
      ]

      mockEmitter.emit('test:end', testEndNode)

      const logCalls = mockClient.getCallsByMethod('sendLog')
      assert.strictEqual(logCalls.length, 1, 'Should send error log')
      assert.strictEqual(logCalls[0].args[1].level, PREDEFINED_LOG_LEVELS.ERROR)
      assert.ok(
        logCalls[0].args[1].message.includes('Something went wrong'),
        'Log should contain error message',
      )
    })
  })

  describe('Groups', () => {
    test('creates suite item for group', async () => {
      const { mockClient, mockEmitter } = createReporter()

      mockEmitter.emit('runner:start', {})
      await new Promise((r) => setTimeout(r, 10))

      mockEmitter.emit('group:start', createGroupStartNode('Math operations'))

      const startCalls = mockClient.getCallsByMethod('startTestItem')
      assert.strictEqual(startCalls.length, 1)
      assert.strictEqual(startCalls[0].args[0].name, 'Math operations')
      assert.strictEqual(startCalls[0].args[0].type, TEST_ITEM_TYPES.SUITE)
    })

    test('nests tests under group', async () => {
      const { mockClient, mockEmitter } = createReporter()

      mockEmitter.emit('runner:start', {})
      await new Promise((r) => setTimeout(r, 10))

      // Start group
      mockEmitter.emit('group:start', createGroupStartNode('Math operations'))
      const groupStartCall = mockClient.getLastCall('startTestItem')
      const groupTempId = groupStartCall?.args[0] // This gets the tempId from mock

      // Start test inside group
      mockEmitter.emit('test:start', createTestStartNode('add two numbers'))

      const testStartCalls = mockClient.getCallsByMethod('startTestItem')
      const testStartCall = testStartCalls[1] // Second startTestItem call
      assert.ok(testStartCall, 'Test startTestItem should be called')
      assert.ok(testStartCall.args[2], 'Test should have parentId') // parentId is the third argument
    })

    test('finishes group after tests', async () => {
      const { mockClient, mockEmitter } = createReporter()

      mockEmitter.emit('runner:start', {})
      await new Promise((r) => setTimeout(r, 10))

      mockEmitter.emit('group:start', createGroupStartNode('Math operations'))
      mockEmitter.emit('test:start', createTestStartNode('add two numbers'))
      mockEmitter.emit('test:end', createTestEndNode('add two numbers', 'passed'))
      mockEmitter.emit('group:end', createGroupEndNode('Math operations'))

      const finishCalls = mockClient.getCallsByMethod('finishTestItem')
      // Should have 2 finish calls: one for test, one for group
      assert.strictEqual(finishCalls.length, 2)
    })
  })

  describe('Suites', () => {
    test('creates suite item for suite', async () => {
      const { mockClient, mockEmitter } = createReporter()

      mockEmitter.emit('runner:start', {})
      await new Promise((r) => setTimeout(r, 10))

      mockEmitter.emit('suite:start', createSuiteStartNode('Unit Tests'))

      const startCalls = mockClient.getCallsByMethod('startTestItem')
      assert.strictEqual(startCalls.length, 1)
      assert.strictEqual(startCalls[0].args[0].name, 'Unit Tests')
      assert.strictEqual(startCalls[0].args[0].type, TEST_ITEM_TYPES.SUITE)
    })

    test('finishes suite', async () => {
      const { mockClient, mockEmitter } = createReporter()

      mockEmitter.emit('runner:start', {})
      await new Promise((r) => setTimeout(r, 10))

      mockEmitter.emit('suite:start', createSuiteStartNode('Unit Tests'))
      mockEmitter.emit('suite:end', createSuiteEndNode('Unit Tests'))

      const finishCalls = mockClient.getCallsByMethod('finishTestItem')
      assert.strictEqual(finishCalls.length, 1)
    })
  })

  describe('Nested Structure', () => {
    test('handles suite > group > test hierarchy', async () => {
      const { mockClient, mockEmitter } = createReporter()

      mockEmitter.emit('runner:start', {})
      await new Promise((r) => setTimeout(r, 10))

      // Suite
      mockEmitter.emit('suite:start', createSuiteStartNode('Unit'))

      // Group inside suite
      mockEmitter.emit('group:start', createGroupStartNode('Math'))

      // Test inside group
      mockEmitter.emit('test:start', createTestStartNode('add'))
      mockEmitter.emit('test:end', createTestEndNode('add', 'passed'))

      // Close group
      mockEmitter.emit('group:end', createGroupEndNode('Math'))

      // Close suite
      mockEmitter.emit('suite:end', createSuiteEndNode('Unit'))

      // End run
      mockEmitter.emit('runner:end', { hasError: false })
      await new Promise((r) => setTimeout(r, 10))

      const startCalls = mockClient.getCallsByMethod('startTestItem')
      const finishCalls = mockClient.getCallsByMethod('finishTestItem')

      // 3 items: suite, group, test
      assert.strictEqual(startCalls.length, 3)
      // 3 finishes: test, group, suite
      assert.strictEqual(finishCalls.length, 3)
    })

    test('handles multiple tests in group', async () => {
      const { mockClient, mockEmitter } = createReporter()

      mockEmitter.emit('runner:start', {})
      await new Promise((r) => setTimeout(r, 10))

      mockEmitter.emit('group:start', createGroupStartNode('Math'))

      mockEmitter.emit('test:start', createTestStartNode('add'))
      mockEmitter.emit('test:end', createTestEndNode('add', 'passed'))

      mockEmitter.emit('test:start', createTestStartNode('subtract'))
      mockEmitter.emit('test:end', createTestEndNode('subtract', 'passed'))

      mockEmitter.emit('test:start', createTestStartNode('multiply'))
      mockEmitter.emit('test:end', createTestEndNode('multiply', 'failed'))

      mockEmitter.emit('group:end', createGroupEndNode('Math', true))

      const startCalls = mockClient.getCallsByMethod('startTestItem')
      const finishCalls = mockClient.getCallsByMethod('finishTestItem')

      // 4 items: group + 3 tests
      assert.strictEqual(startCalls.length, 4)
      // 4 finishes
      assert.strictEqual(finishCalls.length, 4)

      // Verify test statuses
      const testFinishes = finishCalls.slice(0, 3) // First 3 are tests
      assert.strictEqual(testFinishes[0].args[1].status, STATUSES.PASSED)
      assert.strictEqual(testFinishes[1].args[1].status, STATUSES.PASSED)
      assert.strictEqual(testFinishes[2].args[1].status, STATUSES.FAILED)
    })
  })

  describe('Error Handling', () => {
    test('sends multiple error logs for test with multiple errors', async () => {
      const { mockClient, mockEmitter } = createReporter()

      mockEmitter.emit('runner:start', {})
      await new Promise((r) => setTimeout(r, 10))

      mockEmitter.emit('test:start', createTestStartNode('multi-error test'))

      const testEndNode: TestEndNode = {
        title: { original: 'multi-error test', expanded: 'multi-error test' },
        tags: [],
        timeout: 2000,
        meta: {},
        isPinned: false,
        duration: 100,
        hasError: true,
        errors: [
          { phase: 'setup', error: new Error('Setup failed') },
          { phase: 'test', error: new Error('Test assertion failed') },
          { phase: 'teardown', error: new Error('Teardown failed') },
        ],
      }

      mockEmitter.emit('test:end', testEndNode)

      const logCalls = mockClient.getCallsByMethod('sendLog')
      assert.strictEqual(logCalls.length, 3, 'Should send 3 error logs')
    })

    test('extends test description with error when configured', async () => {
      const { mockClient, mockEmitter } = createReporter({
        extendTestDescriptionWithLastError: true,
      })

      mockEmitter.emit('runner:start', {})
      await new Promise((r) => setTimeout(r, 10))

      mockEmitter.emit('test:start', createTestStartNode('error test'))

      const testEndNode = createTestEndNode('error test', 'failed')
      testEndNode.errors = [
        {
          phase: 'test',
          error: new Error('Expected 4 to equal 5'),
        },
      ]

      mockEmitter.emit('test:end', testEndNode)

      const finishCall = mockClient.getLastCall('finishTestItem')
      assert.ok(
        finishCall?.args[1].description?.includes('Expected 4 to equal 5'),
        'Description should contain error message',
      )
    })

    test('handles suite errors', async () => {
      const { mockClient, mockEmitter } = createReporter()

      mockEmitter.emit('runner:start', {})
      await new Promise((r) => setTimeout(r, 10))

      mockEmitter.emit('suite:start', createSuiteStartNode('Unit'))

      const suiteEndNode: SuiteEndNode = {
        name: 'Unit',
        hasError: true,
        errors: [{ phase: 'setup', error: new Error('Suite setup failed') }],
      }

      mockEmitter.emit('suite:end', suiteEndNode)

      const logCalls = mockClient.getCallsByMethod('sendLog')
      assert.strictEqual(logCalls.length, 1, 'Should send error log for suite')

      const finishCall = mockClient.getLastCall('finishTestItem')
      assert.strictEqual(finishCall?.args[1].status, STATUSES.FAILED)
    })

    test('handles group errors', async () => {
      const { mockClient, mockEmitter } = createReporter()

      mockEmitter.emit('runner:start', {})
      await new Promise((r) => setTimeout(r, 10))

      mockEmitter.emit('group:start', createGroupStartNode('Math'))

      const groupEndNode: GroupEndNode = {
        title: 'Math',
        meta: {},
        hasError: true,
        errors: [{ phase: 'teardown', error: new Error('Group teardown failed') }],
      }

      mockEmitter.emit('group:end', groupEndNode)

      const logCalls = mockClient.getCallsByMethod('sendLog')
      assert.strictEqual(logCalls.length, 1, 'Should send error log for group')
    })
  })

  describe('Configuration Options', () => {
    test('passes attributes to launch', async () => {
      const { mockClient, mockEmitter } = createReporter({
        attributes: [
          { key: 'env', value: 'test' },
          { key: 'browser', value: 'chrome' },
        ],
      })

      mockEmitter.emit('runner:start', {})
      await new Promise((r) => setTimeout(r, 10))

      const startLaunchCall = mockClient.getLastCall('startLaunch')
      const attributes = startLaunchCall?.args[0].attributes

      // Should have user attributes plus system attribute
      assert.ok(attributes.length >= 2)
      assert.ok(attributes.some((a: any) => a.key === 'env' && a.value === 'test'))
      assert.ok(attributes.some((a: any) => a.key === 'browser' && a.value === 'chrome'))
    })

    test('passes description to launch', async () => {
      const { mockClient, mockEmitter } = createReporter({
        description: 'CI test run',
      })

      mockEmitter.emit('runner:start', {})
      await new Promise((r) => setTimeout(r, 10))

      const startLaunchCall = mockClient.getLastCall('startLaunch')
      assert.strictEqual(startLaunchCall?.args[0].description, 'CI test run')
    })

    test('enables debug logging when debug is true', async () => {
      const originalLog = console.log
      const logs: string[] = []
      console.log = (...args: any[]) => logs.push(args.join(' '))

      try {
        const { mockEmitter } = createReporter({ debug: true })

        mockEmitter.emit('runner:start', {})
        await new Promise((r) => setTimeout(r, 10))

        assert.ok(
          logs.some((l) => l.includes('[RP]')),
          'Should log debug messages',
        )
      } finally {
        console.log = originalLog
      }
    })
  })

  describe('Dataset Tests', () => {
    test('handles tests with datasets', async () => {
      const { mockClient, mockEmitter } = createReporter()

      mockEmitter.emit('runner:start', {})
      await new Promise((r) => setTimeout(r, 10))

      const testStartNode: TestStartNode = {
        title: { original: 'add numbers', expanded: 'add numbers (1 + 2 = 3)' },
        tags: [],
        timeout: 2000,
        meta: {},
        isPinned: false,
        dataset: {
          size: 3,
          index: 0,
          row: { a: 1, b: 2, expected: 3 },
        },
      }

      mockEmitter.emit('test:start', testStartNode)

      const startCall = mockClient.getLastCall('startTestItem')
      // Should use expanded title
      assert.strictEqual(startCall?.args[0].name, 'add numbers (1 + 2 = 3)')
    })
  })

  describe('Full Integration Flow', () => {
    test('complete test run simulation', async () => {
      const { mockClient, mockEmitter } = createReporter({
        launch: 'Integration Test',
        description: 'Full integration test',
        attributes: [{ key: 'type', value: 'integration' }],
      })

      // Start run
      mockEmitter.emit('runner:start', {})
      await new Promise((r) => setTimeout(r, 10))

      // Suite 1
      mockEmitter.emit('suite:start', createSuiteStartNode('Unit Tests'))

      // Group 1 in Suite 1
      mockEmitter.emit('group:start', createGroupStartNode('Math Operations'))

      mockEmitter.emit('test:start', createTestStartNode('addition'))
      mockEmitter.emit('test:end', createTestEndNode('addition', 'passed'))

      mockEmitter.emit('test:start', createTestStartNode('subtraction'))
      mockEmitter.emit('test:end', createTestEndNode('subtraction', 'passed'))

      mockEmitter.emit('test:start', createTestStartNode('division by zero'))
      mockEmitter.emit('test:end', createTestEndNode('division by zero', 'failed'))

      mockEmitter.emit('group:end', createGroupEndNode('Math Operations', true))

      // Group 2 in Suite 1
      mockEmitter.emit('group:start', createGroupStartNode('String Operations'))

      mockEmitter.emit('test:start', createTestStartNode('concatenation'))
      mockEmitter.emit('test:end', createTestEndNode('concatenation', 'passed'))

      mockEmitter.emit('test:start', createTestStartNode('todo: implement split'))
      mockEmitter.emit('test:end', createTestEndNode('todo: implement split', 'todo'))

      mockEmitter.emit('group:end', createGroupEndNode('String Operations'))

      mockEmitter.emit('suite:end', createSuiteEndNode('Unit Tests', true))

      // End run
      mockEmitter.emit('runner:end', { hasError: true })
      await new Promise((r) => setTimeout(r, 50))

      // Verify calls
      const startLaunchCalls = mockClient.getCallsByMethod('startLaunch')
      const finishLaunchCalls = mockClient.getCallsByMethod('finishLaunch')
      const startTestItemCalls = mockClient.getCallsByMethod('startTestItem')
      const finishTestItemCalls = mockClient.getCallsByMethod('finishTestItem')

      assert.strictEqual(startLaunchCalls.length, 1, 'Should start launch once')
      assert.strictEqual(finishLaunchCalls.length, 1, 'Should finish launch once')
      // 1 suite + 2 groups + 5 tests = 8 test items
      assert.strictEqual(startTestItemCalls.length, 8, 'Should start 8 test items')
      assert.strictEqual(finishTestItemCalls.length, 8, 'Should finish 8 test items')
    })
  })
})
