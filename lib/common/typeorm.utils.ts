import { Logger, Type } from '@nestjs/common';
import { Observable } from 'rxjs';
import { delay, retryWhen, scan } from 'rxjs/operators';
import {
  DataSource,
  DataSourceOptions,
  EntityManager
} from 'typeorm';
import { v4 as uuid } from 'uuid';
import { CircularDependencyException } from '../exceptions/circular-dependency.exception';
import { DEFAULT_CONNECTION_NAME } from '../typeorm.constants';
import {Constructor} from "@nestjs/common/utils/merge-with-values.util";

const logger = new Logger('TypeOrmModule');

/**
 * This function generates an injection token for an Entity or Repository
 * @param {EntityClassOrSchema} entity parameter can either be an Entity or Repository
 * @param {string} [connection='default'] DataSource name
 * @returns {string} The Entity | Repository injection token
 */
export function getRepositoryToken(
  entity: Constructor<any>,
  connection: DataSource | DataSourceOptions | string = DEFAULT_CONNECTION_NAME,
) {
  if (entity === null || entity === undefined) {
    throw new CircularDependencyException('@InjectRepository()');
  }
  const connectionPrefix = getDataSourcePrefix(connection);

  return `${connectionPrefix}${entity.name}Repository`;
}

/**
 * This function returns a DataSource injection token for the given DataSource, DataSourceOptions or connection name.
 * @param {DataSource | DataSourceOptions | string} [connection='default'] This optional parameter is either
 * a DataSource, or a DataSourceOptions or a string.
 * @returns {string | Function} The DataSource injection token.
 */
export function getDataSourceToken(
  connection: DataSource | DataSourceOptions | string = DEFAULT_CONNECTION_NAME,
): string | Function | Type<DataSource> {
  return DEFAULT_CONNECTION_NAME === connection
    ? DataSource
    : 'string' === typeof connection
    ? `${connection}DataSource`
    : DEFAULT_CONNECTION_NAME === connection.name || !connection.name
    ? DataSource
    : `${connection.name}DataSource`;
}

/**
 * This function returns a DataSource prefix based on the connection name
 * @param {DataSource | DataSourceOptions | string} [connection='default'] This optional parameter is either
 * a DataSource, or a DataSourceOptions or a string.
 * @returns {string | Function} The DataSource injection token.
 */
export function getDataSourcePrefix(
  connection: DataSource | DataSourceOptions | string = DEFAULT_CONNECTION_NAME,
): string {
  if (connection === DEFAULT_CONNECTION_NAME) {
    return '';
  }
  if (typeof connection === 'string') {
    return connection + '_';
  }
  if (connection.name === DEFAULT_CONNECTION_NAME || !connection.name) {
    return '';
  }
  return connection.name + '_';
}

/**
 * This function returns an EntityManager injection token for the given DataSource, DataSourceOptions or connection name.
 * @param {DataSource | DataSourceOptions | string} [connection='default'] This optional parameter is either
 * a DataSource, or a DataSourceOptions or a string.
 * @returns {string | Function} The EntityManager injection token.
 */
export function getEntityManagerToken(
  connection: DataSource | DataSourceOptions | string = DEFAULT_CONNECTION_NAME,
): string | Function {
  return DEFAULT_CONNECTION_NAME === connection
    ? EntityManager
    : 'string' === typeof connection
    ? `${connection}EntityManager`
    : DEFAULT_CONNECTION_NAME === connection.name || !connection.name
    ? EntityManager
    : `${connection.name}EntityManager`;
}

export function handleRetry(
  retryAttempts = 9,
  retryDelay = 3000,
  connectionName = DEFAULT_CONNECTION_NAME,
  verboseRetryLog = false,
  toRetry?: (err: any) => boolean,
): <T>(source: Observable<T>) => Observable<T> {
  return <T>(source: Observable<T>) =>
    source.pipe(
      retryWhen((e) =>
        e.pipe(
          scan((errorCount, error: Error) => {
            if (toRetry && !toRetry(error)) {
              throw error;
            }
            const connectionInfo =
              connectionName === DEFAULT_CONNECTION_NAME
                ? ''
                : ` (${connectionName})`;
            const verboseMessage = verboseRetryLog
              ? ` Message: ${error.message}.`
              : '';

            logger.error(
              `Unable to connect to the database${connectionInfo}.${verboseMessage} Retrying (${errorCount +
                1})...`,
              error.stack,
            );
            if (errorCount + 1 >= retryAttempts) {
              throw error;
            }
            return errorCount + 1;
          }, 0),
          delay(retryDelay),
        ),
      ),
    );
}

export function getDataSourceName(options: DataSourceOptions) {
  return options && options.name ? options.name : DEFAULT_CONNECTION_NAME;
}

export const generateString = () => uuid();
