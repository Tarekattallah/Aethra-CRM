type Language = 'ar' | 'en';
type Copy = { ar: [string, string]; en: [string, string] };
const services: Record<string, Copy> = {
  'mobile-apps': { ar: ['تطبيقات الموبايل', 'تطوير تطبيقات الموبايل مع لوحة تحكم لإدارة مشروعك.'], en: ['Mobile apps', 'Mobile applications with a dashboard to manage your project.'] },
  'web-systems': { ar: ['المواقع والمتاجر الإلكترونية', 'مواقع تعريفية ومتاجر إلكترونية وتطبيقات ويب تناسب احتياجك.'], en: ['Websites and online stores', 'Business websites, online stores and web applications tailored to your needs.'] },
  'paid-ads': { ar: ['إدارة الحملات الإعلانية', 'إعداد وإدارة الإعلانات الرقمية ومتابعة نتائجها.'], en: ['Paid advertising', 'Planning and managing digital advertising campaigns and tracking their results.'] },
  'reels-motion': { ar: ['مونتاج الفيديو والرسوم المتحركة', 'تعديل الفيديوهات القصيرة وإنتاج الرسوم المتحركة الإعلانية.'], en: ['Video editing and motion graphics', 'Short video editing and promotional motion graphics.'] },
  'branding-uiux': { ar: ['الهوية البصرية وتصميم الواجهات', 'تصميم الهوية البصرية والشعارات وتجربة استخدام المواقع والتطبيقات.'], en: ['Branding and interface design', 'Brand identities, logos, and user experiences for websites and apps.'] }
};
const departments: Record<string, Copy> = {
  'software-dev': { ar: ['البرمجيات والمواقع', 'تطوير المواقع والمتاجر والتطبيقات.'], en: ['Software and web development', 'Websites, online stores and applications.'] },
  'digital-marketing': { ar: ['التسويق الرقمي', 'الإعلانات والتسويق وتحسين ظهور نشاطك.'], en: ['Digital marketing', 'Advertising, marketing and growing your online presence.'] },
  'video-editing': { ar: ['الفيديو والإنتاج المرئي', 'المونتاج وصناعة الفيديو والرسوم المتحركة.'], en: ['Video and media production', 'Video editing, production and motion graphics.'] },
  'graphic-design': { ar: ['التصميم والهوية البصرية', 'الهويات البصرية والتصميم وتجربة المستخدم.'], en: ['Design and branding', 'Brand identities, visual design and user experience.'] }
};
const arabic = /[\u0600-\u06ff]/;
function copy(original: string | undefined, explicit: string | undefined, language: Language, fallback: string) {
  if (explicit) return explicit;
  if (!original) return fallback;
  return language === 'en' ? arabic.test(original) ? fallback : original : arabic.test(original) ? original : fallback;
}

export function localizeService(service: any, language: Language) {
  const known = services[service.slug]?.[language];
  return {
    _id: service._id, slug: service.slug, trackId: service.trackId,
    name: service[language === 'en' ? 'nameEn' : 'nameAr'] || known?.[0] || copy(service.name, undefined, language, language === 'en' ? 'Additional service' : 'خدمة إضافية'),
    description: service[language === 'en' ? 'descriptionEn' : 'descriptionAr'] || known?.[1] || copy(service.description, undefined, language, ''),
    dynamicFormFields: (service.dynamicFormFields || []).map((field: any, index: number) => ({
      name: field.name, type: field.type, required: field.required,
      label: copy(field.label, field[language === 'en' ? 'labelEn' : 'labelAr'], language, language === 'en' ? `Question ${index + 1}` : `سؤال ${index + 1}`),
      placeholder: copy(field.placeholder, field[language === 'en' ? 'placeholderEn' : 'placeholderAr'], language, ''),
      // Values remain canonical, so switching language never changes saved answers.
      options: field.options,
      optionLabels: Object.fromEntries((field.options || []).map((option: string, optionIndex: number) => [option,
        copy(option, field[language === 'en' ? 'optionLabelsEn' : 'optionLabelsAr']?.[option], language, language === 'en' ? `Option ${optionIndex + 1}` : `اختيار ${optionIndex + 1}`)
      ]))
    }))
  };
}
export function localizeDepartment(department: any, language: Language) {
  const known = departments[department.slug]?.[language];
  return { _id: department._id, slug: department.slug, color: department.color,
    name: department[language === 'en' ? 'nameEn' : 'nameAr'] || known?.[0] || copy(department.name, undefined, language, language === 'en' ? 'Additional department' : 'قسم إضافي'),
    description: department[language === 'en' ? 'descriptionEn' : 'descriptionAr'] || known?.[1] || copy(department.description, undefined, language, '') };
}
