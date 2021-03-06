import * as APP_CONFIG from '../app.config';
import { JwtStrategy } from '../common/jwt.strategy';
import { ServiceModule } from '../service/service.module';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './controllers/auth/auth.controller';
import { CategoriesController } from './controllers/categories/categories.controller';
import { CommentController } from './controllers/comments/comment.controller';
import { OptionController } from './controllers/options/option.controller';
import { PostController } from './controllers/posts/post.controller';
import { UserController } from './controllers/users/user.controller';
import { WechatController } from './controllers/wechat/wechat.controller';

const controllers = [
  AuthController,
  CategoriesController,
  CommentController,
  OptionController,
  PostController,
  UserController,
  WechatController,
];

@Module({
  imports: [
    PassportModule.register({
      defaultStrategy: 'jwt',
    }),
    JwtModule.register({
      secretOrPrivateKey: APP_CONFIG.AUTH.jwtTokenSecret,
      signOptions: { expiresIn: APP_CONFIG.AUTH.expiresIn },
    }),
  ],
  controllers: [...controllers],
  providers: [ServiceModule, JwtStrategy],
})
export class RestApiModule {
}
