import {
  DynamicModule,
  Global,
  Inject,
  Logger,
  Module,
  OnApplicationShutdown,
  Provider,
  Type,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { defer, lastValueFrom, of } from 'rxjs';
import {
  DataSource,
  DataSourceOptions
} from 'typeorm';
import {
  generateString, getDataSourceName,
  getDataSourceToken,
  getEntityManagerToken,
  handleRetry,
} from './common/typeorm.utils';
import { EntitiesMetadataStorage } from './entities-metadata.storage';
import {
  TypeOrmDataSourceFactory,
  TypeOrmModuleAsyncOptions,
  TypeOrmModuleOptions,
  TypeOrmOptionsFactory,
} from './interfaces/typeorm-options.interface';
import { TYPEORM_MODULE_ID, TYPEORM_MODULE_OPTIONS } from './typeorm.constants';

@Global()
@Module({})
export class TypeOrmCoreModule implements OnApplicationShutdown {
  private readonly logger = new Logger('TypeOrmModule');

  constructor(
    @Inject(TYPEORM_MODULE_OPTIONS)
    private readonly options: TypeOrmModuleOptions,
    private readonly moduleRef: ModuleRef,
  ) {}

  static forRoot(options: TypeOrmModuleOptions): DynamicModule {
    const typeOrmModuleOptions = {
      provide: TYPEORM_MODULE_OPTIONS,
      useValue: options,
    };
    const connectionProvider = {
      provide: getDataSourceToken(options as DataSourceOptions) as string,
      useFactory: async () => await this.createDataSourceFactory(options),
    };
    const entityManagerProvider = this.createEntityManagerProvider(
      options as DataSourceOptions,
    );
    return {
      module: TypeOrmCoreModule,
      providers: [
        entityManagerProvider,
        connectionProvider,
        typeOrmModuleOptions,
      ],
      exports: [entityManagerProvider, connectionProvider],
    };
  }

  static forRootAsync(options: TypeOrmModuleAsyncOptions): DynamicModule {
    const connectionProvider = {
      provide: getDataSourceToken(options as DataSourceOptions) as string,
      useFactory: async (typeOrmOptions: TypeOrmModuleOptions) => {
        if (options.name) {
          return await this.createDataSourceFactory(
            {
              ...typeOrmOptions,
              name: options.name,
            },
            options.connectionFactory,
          );
        }
        return await this.createDataSourceFactory(
          typeOrmOptions,
          options.connectionFactory,
        );
      },
      inject: [TYPEORM_MODULE_OPTIONS],
    };
    const entityManagerProvider = {
      provide: getEntityManagerToken(options as DataSourceOptions) as string,
      useFactory: (source: DataSource) => source.manager,
      inject: [getDataSourceToken(options as DataSourceOptions)],
    };

    const asyncProviders = this.createAsyncProviders(options);
    return {
      module: TypeOrmCoreModule,
      imports: options.imports,
      providers: [
        ...asyncProviders,
        entityManagerProvider,
        connectionProvider,
        {
          provide: TYPEORM_MODULE_ID,
          useValue: generateString(),
        },
      ],
      exports: [entityManagerProvider, connectionProvider],
    };
  }

  async onApplicationShutdown() {
    if (this.options.keepConnectionAlive) {
      return;
    }
    const source = this.moduleRef.get<DataSource>(
      getDataSourceToken(this.options as DataSourceOptions) as Type<DataSource>,
    );
    try {
      source && (await source.close());
    } catch (e: any) {
      this.logger.error(e?.message);
    }
  }

  private static createAsyncProviders(
    options: TypeOrmModuleAsyncOptions,
  ): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this.createAsyncOptionsProvider(options)];
    }
    const useClass = options.useClass as Type<TypeOrmOptionsFactory>;
    return [
      this.createAsyncOptionsProvider(options),
      {
        provide: useClass,
        useClass,
      },
    ];
  }

  private static createAsyncOptionsProvider(
    options: TypeOrmModuleAsyncOptions,
  ): Provider {
    if (options.useFactory) {
      return {
        provide: TYPEORM_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }
    // `as Type<TypeOrmOptionsFactory>` is a workaround for microsoft/TypeScript#31603
    const inject = [
      (options.useClass || options.useExisting) as Type<TypeOrmOptionsFactory>,
    ];
    return {
      provide: TYPEORM_MODULE_OPTIONS,
      useFactory: async (optionsFactory: TypeOrmOptionsFactory) =>
        await optionsFactory.createTypeOrmOptions(options.name),
      inject,
    };
  }

  private static createEntityManagerProvider(
    options: DataSourceOptions,
  ): Provider {
    return {
      provide: getEntityManagerToken(options) as string,
      useFactory: (connection: DataSource) => connection.manager,
      inject: [getDataSourceToken(options)],
    };
  }

  private static async createDataSourceFactory(
    options: TypeOrmModuleOptions,
    connectionFactory?: TypeOrmDataSourceFactory,
  ): Promise<DataSource> {
    const connectionToken = getDataSourceName(options as DataSourceOptions);
    const createTypeormDataSource = connectionFactory ?? ((options: DataSourceOptions) => DataSource.create(options).connect());
    return await lastValueFrom(
      defer(() => {
        /* TODO: CRITICAL
        try {
          if (options.keepConnectionAlive) {
            const connectionName = getDataSourceName(
              options as DataSourceOptions,
            );
            const manager = getDataSourceManager();
            if (manager.has(connectionName)) {
              const connection = manager.get(connectionName);
              if (connection.isConnected) {
                return of(connection);
              }
            }
          }
        } catch {}*/

        if (!options.autoLoadEntities) {
          return createTypeormDataSource(options as DataSourceOptions);
        }

        let entities = options.entities;
        if (entities) {
          entities = entities.concat(
            EntitiesMetadataStorage.getEntitiesByDataSource(connectionToken),
          );
        } else {
          entities =
            EntitiesMetadataStorage.getEntitiesByDataSource(connectionToken);
        }
        return createTypeormDataSource({
          ...options,
          entities,
        } as DataSourceOptions);
      }).pipe(
        handleRetry(
          options.retryAttempts,
          options.retryDelay,
          connectionToken,
          options.verboseRetryLog,
          options.toRetry,
        ),
      ),
    );
  }
}
