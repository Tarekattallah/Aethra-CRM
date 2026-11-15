# دليل تشغيل Aethra CRM

النظام الداخلي هو Aethra، وصفحة استقبال العملاء تحمل هوية شركة مستقلة قابلة للتعديل بواسطة حساب إدارة المنظومة. الهوية الأولية هي Digency. راجع [README](README.md) للمميزات والصور والبنية.

## المتطلبات

- Node.js 22 أو أحدث وnpm؛ التحقق المحلي تم على Node.js 25.
- MongoDB قيد التشغيل محليًا أو عبر رابط اتصال مخصص.
- برنامج `mongod` لتشغيل اختبارات التكامل على قاعدة مؤقتة مستقلة.

## تثبيت نسخة جديدة

```powershell
git clone https://github.com/Tarekattallah/Aethra-CRM.git
cd Aethra-CRM
npm --prefix server ci
npm --prefix client ci
Copy-Item server/.env.example server/.env
```

في نسخة موجودة، احتفظ بملف الإعدادات الحالي ولا تستبدله بنموذج فارغ. على macOS/Linux استخدم `cp` بدل `Copy-Item`.

عدّل `server/.env` لتحديد اتصال MongoDB وعنوان الواجهة، وأضف `JWT_SECRET` بطول 32 حرفًا على الأقل. لتوليد قيمة محلية:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

ملفات الإعدادات وبيانات الدخول وملفات MongoDB والمرفقات المحلية مستبعدة من Git.

## تشغيل التطوير

في طرفية أولى:

```powershell
npm --prefix server run dev
```

وفي طرفية ثانية:

```powershell
npm --prefix client run dev
```

| الخدمة | الرابط |
| --- | --- |
| الواجهة | `http://localhost:5173` |
| API | `http://localhost:5000/api` |
| فحص الاتصال بقاعدة البيانات | `http://localhost:5000/api/health` |

## إنشاء أول حساب لإدارة المنظومة

على قاعدة جديدة:

```powershell
npm --prefix server run bootstrap:superadmin -- --email owner@example.com --confirm --create
```

يولّد الأمر كلمة مرور عشوائية ويحفظها محليًا في `server/.env.superadmin.local`. الملف مستبعد من Git. يرفض إنشاء حساب محمي ثانٍ. عند استخدام حساب أدمن موجود ومؤهل يمكن حذف `--create` لترقيته مع الحفاظ على كلمة مروره.

اضغط شعار صفحة العملاء ست مرات لفتح دخول الموظفين. بعد الدخول، أنشئ حسابات العمل والأدوار والتراكات والخدمات من الإدارة. التشغيل العادي لا ينشئ حسابات تجريبية ولا يستبدل حساباتك الموجودة.

يمكن إنشاء بيانات تجريبية على قاعدة فارغة مخصصة للتجربة فقط:

```powershell
npm --prefix server run seed
```

الأمر يرفض قاعدة تحتوي بيانات ويرفض وضع production. بيانات seed مخصصة للتجربة وليست بيانات حسابات التثبيت الفعلي.

## البناء والاختبارات

```powershell
npm --prefix server run build
npm --prefix client run build
npm --prefix server test
```

الاختبارات تشغّل MongoDB مؤقتة مستقلة ثم تنظف بيانات الاختبار فقط. إذا لم يتعرف الاختبار على `mongod`:

```powershell
$env:MONGOD_BINARY = (Get-Command mongod).Source
npm --prefix server test
```

يمكن تعيين المسار المطلق لبرنامج `mongod` بدلًا من الأمر السابق.

## صلاحيات العمل

- الأدمن مدير تشغيل للعملاء والطلبات والتوزيع والتنفيذ والمستحقات والتقارير، بصلاحيات أقل من حساب إدارة المنظومة.
- يوجد 28 إذنًا قابلًا للتفويض للأدوار القديمة والجديدة، مع حدود التراك وملكية الطلب وعضوية الفريق.
- تغيير اسم الشركة ولوجو صفحة العملاء حصري لحساب إدارة المنظومة ولا يُفوض.
- تغييرات الصلاحيات تنهي جلسات الحسابات الوارثة من الدور؛ أعد تسجيل الدخول لتطبيق التغيير.

راجع [كاتلوج الصلاحيات](docs/PERMISSIONS_AND_BRANDING_AR.md) و[فرق التنفيذ والمستحقات](docs/EXECUTION_TEAMS_AR.md).

## تشغيل نسخة مبنية

```powershell
npm --prefix server start
```

قدّم `client/dist` بواسطة خادم ويب يدعم SPA fallback، ووجّه `/api` إلى Express على نفس النطاق العام. اضبط HTTPS و`NODE_ENV=production` واتصال قاعدة البيانات وعنوان الواجهة. إعداد proxy في Vite مخصص للتطوير. احتفظ بقاعدة MongoDB والمرفقات على تخزين دائم مع نسخ احتياطية مستقلة عن كود التطبيق.
