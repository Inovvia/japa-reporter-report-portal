/*
 * @inovvia/japa-reporter-report-portal
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

export interface Attribute {
  value: string
  key?: string
  system?: boolean
}

export interface Issue {
  issueType: string
}
