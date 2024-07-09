import React, { useState, useContext, useLayoutEffect, useEffect } from 'react'
import {
  View,
  ScrollView,
  Alert,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  Dimensions
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import styles from './styles'
import RadioComponent from '../../components/CustomizeComponents/RadioComponent/RadioComponent'
import CheckComponent from '../../components/CustomizeComponents/CheckComponent/CheckComponent'
import TitleComponent from '../../components/CustomizeComponents/TitleComponent/TitleComponent'
import CartComponent from '../../components/CustomizeComponents/CartComponent/CartComponent'
import HeadingComponent from '../../components/CustomizeComponents/HeadingComponent/HeadingComponent'
import ImageHeader from '../../components/CustomizeComponents/ImageHeader/ImageHeader'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import { theme } from '../../utils/themeColors'
import UserContext from '../../context/User'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { TextField } from 'react-native-material-textfield'
import analytics from '../../utils/analytics'
import { HeaderBackButton } from '@react-navigation/elements'
import { MaterialIcons } from '@expo/vector-icons'
import navigationService from '../../routes/navigationService'
import { useTranslation } from 'react-i18next'
import FrequentlyBoughtTogether from '../../components/ItemDetail/Section'
import { IMAGE_LINK } from '../../utils/constants'
import TextDefault from '../../components/Text/TextDefault/TextDefault'
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated'
import { scale } from '../../utils/scaling'
const { height } = Dimensions.get('window')
function ItemDetail(props) {
  const Analytics = analytics()

  const { food, addons, options, restaurant } = props.route.params
  const navigation = useNavigation()
  const { t } = useTranslation()

  const [selectedVariation, setSelectedVariation] = useState({
    ...food.variations[0],
    addons: food.variations[0].addons.map((fa) => {
      const addon = addons.find((a) => a._id === fa)
      const addonOptions = addon.options.map((ao) => {
        return options.find((o) => o._id === ao)
      })
      return {
        ...addon,
        options: addonOptions
      }
    })
  })

  const imageUrl =
    food?.image && food?.image.trim() !== '' ? food.image : IMAGE_LINK

  const [selectedAddons, setSelectedAddons] = useState([])
  const [specialInstructions, setSpecialInstructions] = useState('')
  const {
    restaurant: restaurantCart,
    setCartRestaurant,
    cart,
    addQuantity,
    addCartItem
  } = useContext(UserContext)
  const themeContext = useContext(ThemeContext)
  const currentTheme = theme[themeContext.ThemeValue]
  const inset = useSafeAreaInsets()

  useFocusEffect(() => {
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor(currentTheme.menuBar)
    }
    StatusBar.setBarStyle(
      themeContext.ThemeValue === 'Dark' ? 'light-content' : 'dark-content'
    )
  })
  useEffect(() => {
    async function Track() {
      await Analytics.track(Analytics.events.OPENED_RESTAURANT_ITEM, {
        restaurantID: restaurant,
        foodID: food._id,
        foodName: food.title,
        foodRestaurantName: food.restaurantName
      })
    }
    Track()
  })
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: null,
      title: food.restaurantName,
      headerTitleAlign: 'center',
      headerStyle: {
        backgroundColor: currentTheme.newheaderBG
      },
      headerTitleStyle: {
        color: currentTheme.newFontcolor
      },
      headerShadowVisible: false,
      headerLeft: () => (
        <HeaderBackButton
          truncatedLabel=''
          backImage={() => (
            <View style={styles(currentTheme).backBtnContainer}>
              <MaterialIcons name="arrow-back" size={25} color={currentTheme.newIconColor} />
            </View>
          )}
          onPress={() => {
            navigationService.goBack()
          }}
        />
      )
    })
  }, [navigation])

  function validateButton() {
    if (!selectedVariation) return false
    const validatedAddons = []
    selectedVariation.addons.forEach((addon) => {
      const selected = selectedAddons.find((ad) => ad._id === addon._id)
      if (!selected && addon.quantityMinimum === 0) {
        validatedAddons.push(false)
      } else if (
        selected &&
        selected?.options?.length >= addon.quantityMinimum &&
        selected.options.length <= addon.quantityMaximum
      ) {
        validatedAddons.push(false)
      } else validatedAddons.push(true)
    })
    return validatedAddons.every((val) => val === false)
  }

  async function onPressAddToCart(quantity) {
    if (validateOrderItem()) {
      Analytics.track(Analytics.events.ADD_TO_CART, {
        title: food.title,
        restaurantName: food.restaurantName,
        variations: food.variations
      })
      if (!restaurantCart || restaurant === restaurantCart) {
        await addToCart(quantity, restaurant !== restaurantCart)
      } else if (food.restaurant !== restaurantCart) {
        Alert.alert(
          '',
          t('cartClearWarning'),
          [
            {
              text: t('Cancel'),
              onPress: () => console.log('Cancel Pressed'),
              style: 'cancel'
            },
            {
              text: t('okText'),
              onPress: async () => {
                await addToCart(quantity, true)
              }
            }
          ],
          { cancelable: false }
        )
      }
    }
  }

  const addToCart = async (quantity, clearFlag) => {
    const addons = selectedAddons.map((addon) => ({
      ...addon,
      options: addon.options.map(({ _id }) => ({
        _id
      }))
    }))

    const cartItem = clearFlag
      ? null
      : cart.find((cartItem) => {
        if (
          cartItem._id === food._id &&
          cartItem.variation._id === selectedVariation._id
        ) {
          if (cartItem?.addons?.length === addons.length) {
            if (addons.length === 0) return true
            const addonsResult = addons.every((newAddon) => {
              const cartAddon = cartItem.addons.find(
                (ad) => ad._id === newAddon._id
              )

              if (!cartAddon) return false
              const optionsResult = newAddon.options.every((newOption) => {
                const cartOption = cartAddon.options.find(
                  (op) => op._id === newOption._id
                )

                if (!cartOption) return false
                return true
              })

              return optionsResult
            })

            return addonsResult
          }
        }
        return false
      })

    if (!cartItem) {
      await setCartRestaurant(restaurant)
      await addCartItem(
        food._id,
        selectedVariation._id,
        quantity,
        addons,
        clearFlag,
        specialInstructions
      )
    } else {
      await addQuantity(cartItem.key, quantity)
    }
    navigation.goBack()
  }

  function onSelectVariation(variation) {
    setSelectedVariation({
      ...variation,
      addons: variation.addons.map((fa) => {
        const addon = addons.find((a) => a._id === fa)
        const addonOptions = addon.options.map((ao) => {
          return options.find((o) => o._id === ao)
        })
        return {
          ...addon,
          options: addonOptions
        }
      })
    })
  }

  async function onSelectOption(addon, option) {
    const index = selectedAddons.findIndex((ad) => ad._id === addon._id)
    if (index > -1) {
      if (addon.quantityMinimum === 1 && addon.quantityMaximum === 1) {
        selectedAddons[index].options = [option]
      } else {
        const optionIndex = selectedAddons[index].options.findIndex(
          (opt) => opt._id === option._id
        )
        if (optionIndex > -1) {
          selectedAddons[index].options = selectedAddons[index].options.filter(
            (opt) => opt._id !== option._id
          )
        } else {
          selectedAddons[index].options.push(option)
        }
        if (!selectedAddons[index].options.length) {
          selectedAddons.splice(index, 1)
        }
      }
    } else {
      selectedAddons.push({ _id: addon._id, options: [option] })
    }
    setSelectedAddons([...selectedAddons])
  }

  function calculatePrice() {
    const variation = selectedVariation.price
    let addons = 0
    selectedAddons.forEach((addon) => {
      addons += addon.options.reduce((acc, option) => {
        return acc + option.price
      }, 0)
    })
    return (variation + addons).toFixed(2)
  }

  function validateOrderItem() {
    const validatedAddons = selectedVariation.addons.map((addon) => {
      const selected = selectedAddons.find((ad) => ad._id === addon._id)

      if (!selected && addon.quantityMinimum === 0) {
        addon.error = false
      } else if (
        selected &&
        selected.options.length >= addon.quantityMinimum &&
        selected.options.length <= addon.quantityMaximum
      ) {
        addon.error = false
      } else addon.error = true
      return addon
    })
    setSelectedVariation({ ...selectedVariation, addons: validatedAddons })
    return validatedAddons.every((addon) => addon.error === false)
  }

  function renderOption(addon) {
    if (addon.quantityMinimum === 1 && addon.quantityMaximum === 1) {
      return (
        <View>
          <RadioComponent
            options={addon.options}
            onPress={onSelectOption.bind(this, addon)}
          />
          {addon.error && (
            <TextDefault small textColor={currentTheme.textErrorColor}>
              {t('selectOptionforAddon')}
            </TextDefault>
          )}
        </View>
      )
    } else {
      return (
        <View>
          <CheckComponent
            options={addon.options}
            onPress={onSelectOption.bind(this, addon)}
          />
          {addon.error && (
            <TextDefault small textColor={currentTheme.textErrorColor}>
              {t('selectOptionforAddon')}
            </TextDefault>
          )}
        </View>
      )
    }
  }
  const scrollY = useSharedValue(0)
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  })
  const scrollAnimatedStyles = useAnimatedStyle(() => {
    const translateY = interpolate(scrollY.value, [50, 160], [0, -160], Extrapolation.CLAMP)
    return { transform: [{ translateY }] }
  })

  const animatedImageStyles = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollY.value,
      [0, 160],
      [1, 0],
      Extrapolation.CLAMP
    )

    return { transform: [{ scale }] }
  })

  const animatedImageOpacityStyles = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, 80, 160], [1, 0, 0])
    return { opacity }
  })

  const animatedTitleStyle = (fadeIn) => useAnimatedStyle(() => {
    const outputRange = fadeIn ? [0, 0, 1] : [1, 0, 0]
    const opacity = interpolate(scrollY.value, [0, 50, 160], outputRange)
    return { opacity }
  })

  return (
    <>
      <View style={[styles().flex, styles(currentTheme).mainContainer]}>
        <Animated.View style={[animatedTitleStyle(true), { backgroundColor: 'white', height: 100, zIndex: 99, position: 'absolute' }]}>
          <HeadingComponent title={food.title} price={calculatePrice()} />
        </Animated.View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : null}
          style={styles().flex}
        >

          {imageUrl &&
            <Animated.View style={[animatedImageStyles, animatedImageOpacityStyles]}>
              <ImageHeader image={imageUrl} />
            </Animated.View>}
          <Animated.View style={scrollAnimatedStyles}>
            <Animated.ScrollView
              onScroll={scrollHandler}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1, paddingBottom: scale(height * 0.09) }}
            >
              <View style={styles().subContainer}>
                <Animated.View style={[animatedTitleStyle(false)]}>
                  <HeadingComponent title={food.title} price={calculatePrice()} />
                </Animated.View>
                {food?.variations?.length > 1 && (
                  <View>
                    <TitleComponent
                      title={t('SelectVariation')}
                      subTitle={t('SelectOne')}
                      status={t('Required')}
                    />
                    <RadioComponent
                      options={food.variations}
                      selected={selectedVariation}
                      onPress={onSelectVariation}
                    />
                  </View>
                )}
                {selectedVariation.addons.map((addon) => (
                  <View key={addon._id}>
                    <TitleComponent
                      title={addon.title}
                      subTitle={addon.description}
                      error={addon.error}
                      status={
                        addon.quantityMinimum === 0
                          ? t('optional')
                          : `${addon.quantityMinimum} ${t('Required')}`
                      }
                    />
                    {renderOption(addon)}
                  </View>
                ))}
              </View>

              <View style={styles(currentTheme).line}></View>
              <View style={styles(currentTheme).inputContainer}>
                <TitleComponent
                  title={t('specialInstructions')}
                  subTitle={t('anySpecificPreferences')}
                  status={t('optional')}
                />
                <TextField
                  style={styles(currentTheme).input}
                  placeholder={t('noMayo')}
                  textAlignVertical='center'
                  value={specialInstructions}
                  onChangeText={setSpecialInstructions}
                  maxLength={144}
                  textColor={currentTheme.fontMainColor}
                  baseColor={currentTheme.lightHorizontalLine}
                  errorColor={currentTheme.textErrorColor}
                  tintColor={currentTheme.themeBackground}
                  placeholderTextColor={currentTheme.fontGrayNew}
                />
              </View>
              {/** frequently bought together */}
              <FrequentlyBoughtTogether
                itemId={food._id}
                restaurantId={restaurant}
              />
            </Animated.ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>

      <View style={{ backgroundColor: currentTheme.themeBackground }}>
        <CartComponent onPress={onPressAddToCart} disabled={validateButton()} />
      </View>
      <View
        style={{
          paddingBottom: inset.bottom,
          backgroundColor: currentTheme.themeBackground
        }}
      />
    </>
  )
}

export default ItemDetail
