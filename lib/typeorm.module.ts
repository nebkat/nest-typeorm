import { DynamicModule, Module } from '@nestjs/common';
import { DataSource, DataSourceOptions } from 'typeorm';
import { EntitiesMetadataStorage } from './entities-metadata.storage';
import {
  TypeOrmModuleAsyncOptions,
  TypeOrmModuleOptions,
} from './interfaces/typeorm-options.interface';
import { TypeOrmCoreModule } from './typeorm-core.module';
import { DEFAULT_CONNECTION_NAME } from './typeorm.constants';
import { createTypeOrmProviders } from './typeorm.providers';
import {Constructor} from "@nestjs/common/utils/merge-with-values.util";

@Module({})
export class TypeOrmModule {
  static forRoot(options: TypeOrmModuleOptions): DynamicModule {
    return {
      module: TypeOrmModule,
      imports: [TypeOrmCoreModule.forRoot(options)],
    };
  }

  static forFeature(
    entities: Constructor<any>[] = [],
    connection:
      | DataSource
      | DataSourceOptions
      | string = DEFAULT_CONNECTION_NAME,
  ): DynamicModule {
    const providers = createTypeOrmProviders(entities, connection);
    EntitiesMetadataStorage.addEntitiesByDataSource(connection, entities);
    return {
      module: TypeOrmModule,
      providers: providers,
      exports: providers,
    };
  }

  static forRootAsync(options: TypeOrmModuleAsyncOptions): DynamicModule {
    return {
      module: TypeOrmModule,
      imports: [TypeOrmCoreModule.forRootAsync(options)],
    };
  }
}
