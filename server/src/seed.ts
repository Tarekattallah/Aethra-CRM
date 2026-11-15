import bcrypt from 'bcryptjs';
import { connectDB } from './db.js';
import { ADMIN_OPERATIONAL_PERMISSIONS } from './utils/permissions.js';
import {
  User,
  UserRole,
  ServiceCategory,
  RoutingPointer,
  Counter,
  Role,
  Track
} from './models/index.js';

async function seed() {
  console.log('Starting Aethra Database Seeding...');
  await connectDB();

  const collections = await (await import('mongoose')).default.connection.db!.listCollections().toArray();
  for (const collection of collections) {
    if (await (await import('mongoose')).default.connection.db!.collection(collection.name).findOne()) {
      throw new Error('Refusing to seed a non-empty database. Use a separate empty demo database.');
    }
  }
  if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is disabled in production.');

  const defaultPasswordHash = await bcrypt.hash('password123', 10);

  // 2. إنشاء أدوار النظام الأساسية (System Roles)
  const adminRole = await Role.create({
    name: 'مدير التشغيل (Admin)',
    slug: 'ADMIN',
    description: 'إدارة العملاء والطلبات والتوزيع والتراكات والتقارير اليومية.',
    permissions: ADMIN_OPERATIONAL_PERMISSIONS,
    permissionCatalogVersion: 3,
    isSystem: true
  });

  const teamLeaderRole = await Role.create({
    name: 'تيم ليدر تراك (Team Leader)',
    slug: 'TEAM_LEADER',
    description: 'متابعة طلباته بنفس أدوات المهندس ومراجعة طلبات أعضاء التراك.',
    permissions: [
      'leads:view_track','leads:view_own','leads:edit_technical','routing:receive'
    ],
    isSystem: true
  });

  const engineerRole = await Role.create({
    name: 'مهندس / أخصائي تقني (Specialist)',
    slug: 'ENGINEER',
    description: 'استلام العملاء المسندين إليه، والتواصل معهم، وتوثيق المواصفات الفنية والميزانية.',
    permissions: [
      'leads:view_own',
      'leads:edit_technical','routing:receive'
    ],
    isSystem: true
  });

  const marketingRole = await Role.create({
    name: 'مسؤول حملات وإدخال عملاء (Marketing Staff)',
    slug: 'MARKETING',
    description: 'تسجيل العملاء القادمين من الحملات الإعلانية (المرحلة الأولى والثالثة فقط بدون المواصفات الفنية).',
    permissions: [
      'leads:create_marketing','voice:review'
    ],
    isSystem: true
  });

  console.log('✅ Created 4 System Roles (ADMIN, TEAM_LEADER, ENGINEER, MARKETING).');

  // 3. إنشاء تراكات الشركة الأربعة (Tracks)
  const devTrack = await Track.create({
    name: 'تطوير البرمجيات والويب (Software & Web)',
    slug: 'software-dev',
    description: 'تطوير تطبيقات الجوال، المتاجر الإلكترونية، بوابات الشركات، وأنظمة SaaS و ERP.',
    color: '#1AD6F7',
    isActive: true
  });

  const marketingTrack = await Track.create({
    name: 'التسويق الرقمي والميديا باينج (Digital Marketing)',
    slug: 'digital-marketing',
    description: 'إدارة الحملات الممولة، إعلانات السوشيال ميديا، تحسين محركات البحث SEO، وخطط النمو.',
    color: '#3B82F6',
    isActive: true
  });

  const videoTrack = await Track.create({
    name: 'المونتاج وصناعة الفيديو (Video & Motion)',
    slug: 'video-editing',
    description: 'مونتاج الريلز، فيديوهات اليوتيوب، البودكاست، وفيديوهات الموشن جرافيك الإعلانية.',
    color: '#8B5CF6',
    isActive: true
  });

  const designTrack = await Track.create({
    name: 'التصميم الجرافيكي و UI/UX',
    slug: 'graphic-design',
    description: 'تصميم الهويات البصرية والشعارات، واجهات وتجربة المستخدم للتطبيقات والمواقع، وتصاميم السوشيال ميديا.',
    color: '#EC4899',
    isActive: true
  });

  console.log('✅ Created 4 Tracks: Software Dev, Marketing, Video Editing, Graphic Design.');

  // 4. إنشاء الخدمات وربط كل خدمة بالتراك الخاص بها
  const mobileAppCat = await ServiceCategory.create({
    name: 'تطبيقات الجوال (iOS & Android)',
    slug: 'mobile-apps',
    description: 'تطوير تطبيقات الهواتف الذكية بنظامي Flutter و React Native مع لوحة تحكم سحابية.',
    trackId: devTrack._id,
    isActive: true
  });

  const webAppCat = await ServiceCategory.create({
    name: 'منظومات الويب والمتاجر الإلكترونية',
    slug: 'web-systems',
    description: 'تطوير متاجر إلكترونية احترافية، بوابات SaaS، ومواقع شركات سريعة ومتجاوبة.',
    trackId: devTrack._id,
    isActive: true
  });

  const adsMediaCat = await ServiceCategory.create({
    name: 'إدارة الحملات الممولة (Media Buying)',
    slug: 'paid-ads',
    description: 'حملات إعلانية على فيسبوك، تيك توك، سناب شات، وجوجل مع تتبع دقيق للتحويلات.',
    trackId: marketingTrack._id,
    isActive: true
  });

  const reelsMotionCat = await ServiceCategory.create({
    name: 'مونتاج ريلز وفيديوهات موشن جرافيك',
    slug: 'reels-motion',
    description: 'مونتاج فيديوهات قصيرة سريعة الانتشار وموشن جرافيك ترويجي عالي الاحترافية.',
    trackId: videoTrack._id,
    isActive: true
  });

  const brandingUiCat = await ServiceCategory.create({
    name: 'تصميم الهوية البصرية و UI/UX',
    slug: 'branding-uiux',
    description: 'بناء هوية بصرية متكاملة وشعارات احترافية وتصميم واجهات مستخدم سهلة وجذابة.',
    trackId: designTrack._id,
    isActive: true
  });

  console.log('✅ Created 5 Service Categories linked to Tracks.');

  // 5. إنشاء حسابات التيم ليدرز (Team Leaders)
  const devLeader = await User.create({
    name: 'م. هشام سالم (تيم ليدر البرمجيات)',
    email: 'leader.dev@company.com',
    passwordHash: defaultPasswordHash,
    role: UserRole.TEAM_LEADER,
    roleId: teamLeaderRole._id,
    trackId: devTrack._id,
    permissions: teamLeaderRole.permissions,
    phone: '+201090000001',
    isActive: true,
    maxDailyLeads: 0
  });
  devTrack.teamLeaderId = devLeader._id;
  await devTrack.save();

  const marketingLeader = await User.create({
    name: 'أ. نهى وجدي (تيم ليدر التسويق)',
    email: 'leader.marketing@company.com',
    passwordHash: defaultPasswordHash,
    role: UserRole.TEAM_LEADER,
    roleId: teamLeaderRole._id,
    trackId: marketingTrack._id,
    permissions: teamLeaderRole.permissions,
    phone: '+201090000002',
    isActive: true,
    maxDailyLeads: 0
  });
  marketingTrack.teamLeaderId = marketingLeader._id;
  await marketingTrack.save();

  const videoLeader = await User.create({
    name: 'أ. شادي رءوف (تيم ليدر المونتاج والفيديو)',
    email: 'leader.video@company.com',
    passwordHash: defaultPasswordHash,
    role: UserRole.TEAM_LEADER,
    roleId: teamLeaderRole._id,
    trackId: videoTrack._id,
    permissions: teamLeaderRole.permissions,
    phone: '+201090000003',
    isActive: true,
    maxDailyLeads: 0
  });
  videoTrack.teamLeaderId = videoLeader._id;
  await videoTrack.save();

  const designLeader = await User.create({
    name: 'أ. ميادة عزت (تيم ليدر التصميم)',
    email: 'leader.design@company.com',
    passwordHash: defaultPasswordHash,
    role: UserRole.TEAM_LEADER,
    roleId: teamLeaderRole._id,
    trackId: designTrack._id,
    permissions: teamLeaderRole.permissions,
    phone: '+201090000004',
    isActive: true,
    maxDailyLeads: 0
  });
  designTrack.teamLeaderId = designLeader._id;
  await designTrack.save();

  console.log('✅ Created 4 Track Team Leaders.');

  // 6. إنشاء حساب مدير النظام (Admin)
  await User.create({
    name: 'مدير النظام (Admin)',
    email: 'admin@company.com',
    passwordHash: defaultPasswordHash,
    role: UserRole.ADMIN,
    roleId: adminRole._id,
    permissions: adminRole.permissions,
    phone: '+201000000001',
    isActive: true,
    maxDailyLeads: 0
  });

  // 7. إنشاء مهندسين وأخصائيين لكل تراك
  const specialists = [
    // تراك البرمجيات
    {
      name: 'م. أحمد خالد (تطبيقات جوال)',
      email: 'eng.ahmed@company.com',
      phone: '+201011111101',
      trackId: devTrack._id,
      specializations: [mobileAppCat._id],
      maxDailyLeads: 5
    },
    {
      name: 'م. سارة محمود (منظومات ويب)',
      email: 'eng.sara@company.com',
      phone: '+201011111102',
      trackId: devTrack._id,
      specializations: [webAppCat._id],
      maxDailyLeads: 5
    },
    // تراك التسويق
    {
      name: 'أ. طارق إبراهيم (أخصائي ميديا باينج)',
      email: 'specialist.tarek@company.com',
      phone: '+201011111103',
      trackId: marketingTrack._id,
      specializations: [adsMediaCat._id],
      maxDailyLeads: 5
    },
    // تراك المونتاج
    {
      name: 'أ. زياد ناصر (مونتير فيديو وريلز)',
      email: 'editor.ziad@company.com',
      phone: '+201011111104',
      trackId: videoTrack._id,
      specializations: [reelsMotionCat._id],
      maxDailyLeads: 5
    },
    // تراك التصميم
    {
      name: 'أ. ليلى حسام (مصممة UI/UX وهوية)',
      email: 'designer.layla@company.com',
      phone: '+201011111105',
      trackId: designTrack._id,
      specializations: [brandingUiCat._id],
      maxDailyLeads: 5
    }
  ];

  const createdSpecialists = [];
  for (const spec of specialists) {
    const user = await User.create({
      ...spec,
      passwordHash: defaultPasswordHash,
      role: UserRole.ENGINEER,
      roleId: engineerRole._id,
      permissions: engineerRole.permissions,
      isActive: true
    });
    createdSpecialists.push(user);
  }

  console.log(`✅ Created ${createdSpecialists.length} Specialists across all Tracks.`);

  // 8. إنشاء موظف تسويق إعلاني مخصص لاستمارة الحملات (Marketing Account)
  await User.create({
    name: 'سالي طارق (فريق الإعلانات والتسويق)',
    email: 'marketing@company.com',
    passwordHash: defaultPasswordHash,
    role: UserRole.MARKETING,
    roleId: marketingRole._id,
    permissions: marketingRole.permissions,
    phone: '+201022222201',
    isActive: true,
    maxDailyLeads: 0
  });

  console.log('✅ Created Dedicated Marketing Staff account (marketing@company.com).');

  // 9. تهيئة عدادات الأكواد ومؤشرات التوزيع
  await Counter.create({
    _id: 'leadCode',
    seq: 10000
  });

  await RoutingPointer.create({
    scope: 'GENERAL',
    lastAssignedEngineerId: createdSpecialists[0]._id
  });

  console.log('🎉 Aethra Seeding Completed Successfully!');
  console.log('------------------------------------------------------------------------');
  console.log('👑 Admin:             admin@company.com            | password123');
  console.log('👔 Dev Team Leader:   leader.dev@company.com       | password123');
  console.log('👔 Marketing Leader:  leader.marketing@company.com | password123');
  console.log('👔 Video Leader:      leader.video@company.com     | password123');
  console.log('👔 Design Leader:     leader.design@company.com    | password123');
  console.log('💻 Dev Engineer:      eng.ahmed@company.com        | password123');
  console.log('📈 Ads Specialist:    specialist.tarek@company.com | password123');
  console.log('🎬 Video Editor:      editor.ziad@company.com      | password123');
  console.log('🎨 UI/UX Designer:    designer.layla@company.com   | password123');
  console.log('📢 Marketing Staff:   marketing@company.com        | password123');
  console.log('------------------------------------------------------------------------');

  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seeding Failed:', err);
  process.exit(1);
});
