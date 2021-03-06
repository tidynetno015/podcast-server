import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CacheModule } from '../cache/cache.module';
import { getConfig } from '../config/config-helpers';
import { EventBusModule } from '../event-bus/event-bus.module';

import { PasswordCiper } from './helpers/password-cipher/password-ciper';
import { AttachmentService } from './services/attachment.service';
import { AuthService } from './services/auth.service';
import { CategoriesService } from './services/categories.service';
import { CommentService } from './services/comment.service';
import { OptionService } from './services/option.service';
import { PostService } from './services/post.service';
import { TermService } from './services/term.service';
import { UserService } from './services/user.service';

const exportedProviders = [
  AttachmentService,
  AuthService,
  OptionService,
  TermService,
  CategoriesService,
  PostService,
  CommentService,
  UserService,
];

/**
 * 系统中所有业务服务的提供者
 */
@Module({
  imports: [EventBusModule, TypeOrmModule.forRoot(getConfig().dbConnectionOptions), CacheModule],
  providers: [
    ...exportedProviders,
    PasswordCiper,
  ],
  exports: exportedProviders,
})
export class ServiceModule implements OnModuleInit {
  constructor(
    private optionService: OptionService,
    private userService: UserService,
  ) {
  }

  async onModuleInit() {
    // TODO: 放置一些显示调用，配置与服务的初始
    await this.optionService.initOptions();
    // 初始化系统角色
    // 初始化管理员
    // 初始化微信相关
    // 初始化支付
  }
}
