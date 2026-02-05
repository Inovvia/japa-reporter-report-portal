/*
 * @inovvia/japa-reporter-report-portal
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

export enum PREDEFINED_LOG_LEVELS {
  TRACE = 'TRACE',
  DEBUG = 'DEBUG',
  WARN = 'WARN',
  INFO = 'INFO',
  ERROR = 'ERROR',
  FATAL = 'FATAL',
}

export type LOG_LEVELS = PREDEFINED_LOG_LEVELS | string
