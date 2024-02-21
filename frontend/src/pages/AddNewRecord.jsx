import 'react-phone-input-2/lib/style.css';

import Select from 'react-select';
import { useContext, useEffect, useState } from 'react';
import { MasterContext } from '../context';
import { Controller, useForm } from 'react-hook-form';
import PhoneInput from 'react-phone-input-2';

import CreatableSelect from 'react-select/creatable';
import MasterCardPreview from '../components/MasterCardPreview';
import useAuthenticateUser from '../custom-hooks/useAuthenticateUser';
import {
  formatContactsForSchema,
  formatTagsForSchema,
} from '../helpers/new-master-form';
import {
  trackClickOutsideCard,
  trackEscWhenModalShown,
} from '../helpers/modal';

export default function AddNewRecord() {
  const [successPopup, setSuccessPopup] = useState(false);
  const { state } = useContext(MasterContext);
  const { user, locations, professions, profCategories, countryID } = state;
  const { firstName, username } = user;
  const {
    register,
    handleSubmit,
    setValue,
    control,
    watch,
    formState: { errors, isLoading, isSubmitting, isSubmitSuccessful },
  } = useForm({});

  // As user name is updated in state, update form default value as state changes
  useEffect(() => {
    setValue('telegram', username);
    setValue('name', firstName);
    setValue('useThisPhoto', true);
  }, [username, firstName]);

  // Close modal on click outside / esc
  // TODO: abstract as a separate hook useCloseModal
  useEffect(() => {
    if (successPopup) {
      document.addEventListener('click', (e) =>
        trackClickOutsideCard(e, 'success', setSuccessPopup)
      );
      document.addEventListener('keyup', (e) =>
        trackEscWhenModalShown(e, setSuccessPopup)
      );
    }
    return () => {
      document.removeEventListener('click', trackClickOutsideCard);
      document.removeEventListener('keyup', trackEscWhenModalShown);
    };
  }, [successPopup]);

  // Fetch photo dynamically
  const { photo, telegramID } = useAuthenticateUser();

  // Get live updates from all fields
  const watcher = watch();

  // Card preview, with up-to-date data via watcher
  const masterPreview = {
    photo,
    watcher,
  };

  const [profCategoryID, setProfCategoryID] = useState(
    watcher.profCategoryID || ''
  );

  // Post form on submit
  async function onSubmit(data) {
    const contacts = formatContactsForSchema(data);
    const tags = formatTagsForSchema(data);

    // Add Telegram ID and photo url to user profile
    const dataToSave = {
      ...data,
      telegramID: telegramID || null,
      photo: photo || null,
      countryID,
      contacts,
      tags,
    };

    // Send form data
    const controller = new AbortController();
    await fetch('https://api.majstr.com/addmaster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataToSave),
      signal: controller.signal,
    })
      .then((response) => {
        if (response.ok) {
          setSuccessPopup(true);
          return console.log('Data submitted successfully');
        }
        return Promise.reject(response);
      })
      .catch(console.error);
  }

  return (
    <>
      <div className="create-user-container">
        {/* Form */}
        <div className="create-user-form">
          <div className="create-record-header">
            <h2>Створити запис:</h2>
          </div>
          <form id="add-new-piggy" onSubmit={handleSubmit(onSubmit)}>
            <PhotoInput photo={photo} register={register} />
            <NameInput register={register} errors={errors} />
            <ProfCategoryInput
              control={control}
              profCategories={profCategories}
              setProfCategoryID={setProfCategoryID}
              errors={errors}
            />
            <ProfessionInput
              control={control}
              professions={professions}
              profCategoryID={profCategoryID}
              errors={errors}
            />
            <LocationInput
              control={control}
              locations={locations}
              errors={errors}
            />
            <TagsInput control={control} tags={watcher.tags} errors={errors} />
            <TelephoneInput
              register={register}
              control={control}
              countryID={countryID}
            />
            <InstagramInput register={register} />
            <TelegramInput register={register} />
            <AboutInput register={register} errors={errors} />
            <button
              className={`btn ${
                isLoading || isSubmitting
                  ? 'is-loading'
                  : isSubmitSuccessful
                  ? 'is-loaded'
                  : ''
              } `}
              type="submit"
              disabled={isSubmitSuccessful}
            >
              {`${
                isLoading || isSubmitting
                  ? 'Додаємо запис...'
                  : isSubmitSuccessful
                  ? 'Запис додано!'
                  : 'Створити запис'
              } `}
            </button>
          </form>
        </div>
        {/* Card preview */}
        <MasterCardPreview
          className="master-preview-container"
          master={masterPreview}
        />
      </div>
      {successPopup && <SuccessPopup setSuccessPopup={setSuccessPopup} />}
    </>
  );
}

function PhotoInput({ photo, register }) {
  return (
    photo && (
      <>
        <div
          className="create-user-photo"
          style={{
            backgroundImage: `url(${photo})`,
          }}
        ></div>
        <label>
          <input
            {...register('useThisPhoto')}
            type="checkbox"
            id={'use-this-photo'}
          />
          Використати це фото
        </label>
      </>
    )
  );
}

function NameInput({ register, errors }) {
  return (
    <div className="input-field">
      <label>
        <div className="input-label">
          Ваше імʼя:<span className="required">*</span>
        </div>
        <input
          className={`create-user-input ${
            errors?.name?.message ? 'error' : ''
          }`}
          placeholder="Ваше імʼя"
          {...register('name', {
            required: { value: true, message: 'Це обовʼязкове поле' },
            maxLength: { value: 25, message: 'Максимум 25 символів' },
          })}
        />
      </label>
      <div className="error-message" hidden={!errors?.name?.message}>
        {errors?.name?.message}
      </div>
    </div>
  );
}

function ProfCategoryInput({
  control,
  profCategories,
  setProfCategoryID,
  errors,
}) {
  return (
    <div className="input-field">
      <label>
        <div className="input-label">
          Оберіть професійну категорію<span className="required">*</span>
        </div>
        <Controller
          control={control}
          name="profCategoryID"
          rules={{
            required: {
              value: true,
              message: 'Обовʼязково вкажіть професійну категорію',
            },
          }}
          render={({ field: { onChange } }) => (
            <Select
              onChange={(e) => {
                // Important to call the original onChange provided by Controller
                onChange(e.value);
                setProfCategoryID(e.value);
              }}
              // Style is applied only if there are errors
              styles={
                errors?.profCategoryID?.message && {
                  control: (baseStyles) => ({
                    ...baseStyles,
                    borderColor: 'rgb(255, 77, 77)',
                  }),
                }
              }
              options={profCategories?.map((profCategory) => ({
                value: profCategory.id,
                label: profCategory.name.ua,
              }))}
            />
          )}
        />
      </label>
      <div className="error-message" hidden={!errors?.profCategoryID?.message}>
        {errors?.profCategoryID?.message}
      </div>
    </div>
  );
}

function ProfessionInput({ control, errors, professions, profCategoryID }) {
  const [availableProfessionOptions, setAvailableProfessionOptions] = useState(
    []
  );

  useEffect(() => {
    setAvailableProfessionOptions(
      professions
        ?.filter((profession) => profession.categoryID === profCategoryID)
        .map((profession) => ({
          value: profession.id,
          label: profession.name.ua,
        }))
    );
  }, [profCategoryID]);

  return (
    <div className="input-field">
      <label>
        <div className="input-label">
          Оберіть професію<span className="required">*</span>
        </div>
        <Controller
          control={control}
          name="professionID"
          rules={{
            required: {
              value: true,
              message: 'Обовʼязково вкажіть професію',
            },
          }}
          render={({ field: { onChange } }) => (
            <Select
              onChange={(e) => {
                // Important to call the original onChange provided by Controller
                onChange(e.value);
              }}
              // Style is applied only if there are errors
              styles={
                errors?.professionID?.message && {
                  control: (baseStyles) => ({
                    ...baseStyles,
                    borderColor: 'rgb(255, 77, 77)',
                  }),
                }
              }
              options={availableProfessionOptions}
            />
          )}
        />
      </label>
      <div className="error-message" hidden={!errors?.professionID?.message}>
        {errors?.professionID?.message}
      </div>
    </div>
  );
}

function LocationInput({ control, locations, errors }) {
  return (
    <div className="input-field">
      <label>
        <div className="input-label">
          Оберіть найближче велике місто.<span className="required">*</span>
        </div>
        <Controller
          control={control}
          name="locationID"
          rules={{
            required: { value: true, message: 'Обовʼязково вкажіть місто' },
          }}
          render={({ field: { onChange } }) => (
            <Select
              onChange={(e) => {
                // Important to call the original onChange provided by Controller
                onChange(e.value);
              }}
              // Style is applied only if there are errors
              styles={
                errors?.locationID?.message && {
                  control: (baseStyles) => ({
                    ...baseStyles,
                    borderColor: 'rgb(255, 77, 77)',
                  }),
                }
              }
              options={locations?.map((location) => ({
                value: location.id,
                label: location.name.ua,
              }))}
            />
          )}
        />
      </label>
      <div className="error-message" hidden={!errors?.locationID?.message}>
        {errors?.locationID?.message}
      </div>
    </div>
  );
}

function TagsInput({ control, tags = [], errors }) {
  return (
    <div className="input-field">
      <label>
        <div className="input-label">
          Вкажіть до 3х послуг (наприклад "Заміна мастила", "Техогляд", "Сервіс
          BMW")<span className="required">*</span>
        </div>
        <Controller
          control={control}
          name="tags"
          rules={{
            required: {
              value: true,
              message: 'Вкажіть хоча б одну послугу',
            },
          }}
          render={({ field: { onChange } }) => (
            <CreatableSelect
              isValidNewOption={(value) => {
                // If an option is >3 and <20 then it can be added
                // Also if there are already 3 tags, it can't be added
                return tags.length < 3 && value.length > 3 && value.length < 25;
              }}
              onChange={onChange}
              // Style is applied only if there are errors
              styles={
                errors?.tags?.message && {
                  control: (baseStyles) => ({
                    ...baseStyles,
                    borderColor: 'rgb(255, 77, 77)',
                  }),
                }
              }
              noOptionsMessage={() => 'Введіть назву до 25 символів'}
              formatCreateLabel={(value) => `Додати ${value}`}
              isMulti
            />
          )}
        />
      </label>
      <div className="error-message" hidden={!errors?.tags?.message}>
        {errors?.tags?.message}
      </div>
    </div>
  );
}

function TelephoneInput({ register, control, countryID }) {
  return (
    <div className="input-field">
      <label>
        <div className="input-label">Ваш номер телефону</div>
        <Controller
          control={control}
          name="telephone"
          render={({ field: { onChange } }) => (
            <PhoneInput
              country={countryID?.toLowerCase()}
              countryCodeEditable
              enableSearch
              inputStyle={{ fontWeight: 300 }}
              onChange={onChange}
            ></PhoneInput>
          )}
        />
        <div className="contact-type-container">
          <label>
            <input
              type="checkbox"
              {...register('isTelephone')}
              defaultChecked
            />
            Телефон
          </label>
          <label>
            <input type="checkbox" {...register('isWhatsapp')} />
            Whatsapp
          </label>
          <label>
            <input type="checkbox" {...register('isViber')} />
            Viber
          </label>
        </div>
      </label>
    </div>
  );
}

function InstagramInput({ register }) {
  return (
    <div className="input-field">
      <label>
        <div className="input-label">Instagram: </div>
        <input
          className="create-user-input"
          {...register('instagram')}
          placeholder="Імʼя користувача без @"
        />
      </label>
    </div>
  );
}

function TelegramInput({ register }) {
  return (
    <div className="input-field">
      <label>
        <div className="input-label">Telegram:</div>
        <input className="create-user-input" {...register('telegram')} />
      </label>
    </div>
  );
}

function AboutInput({ register, errors }) {
  return (
    <div className="input-field">
      <label>
        <div className="input-label">
          Інформація про вас<span className="required">*</span>
        </div>
        <textarea
          {...register('about', {
            required: { value: true, message: 'Це обовʼязкове поле' },
          })}
          className={`create-user-input ${
            errors?.about?.message ? 'error' : ''
          }`}
          placeholder={`Додаткова інформація про вас:\nЯкі самі послуги ви надаєте? В якому районі знаходитеся? Що треба знати перед тим, як звертутися до вас?`}
          cols="30"
          rows="6"
        ></textarea>
      </label>
      <div className="error-message" hidden={!errors?.about?.message}>
        {errors?.about?.message}
      </div>
    </div>
  );
}

function SuccessPopup({ setSuccessPopup }) {
  return (
    <div className="modal-overlay">
      <div className="modal-overlay-inside">
        <div className="modal-content" id="success">
          <div className="master-card-body success">
            <div className="master-card-header">
              <h1>☀️ Дякуємо!</h1>
              <div
                className="close-container"
                onClick={() => setSuccessPopup(false)}
              >
                <img src="/img/icons/close.svg" alt="close" />
              </div>
            </div>
            <p>
              Ми отримали інформацію. Картка зʼявиться на сайті після перевірки
              модератором. Ми повідомимо вам про це в телеграм.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
